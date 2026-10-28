import { WorkerRuntimeRepository } from '@mvs/backend/repositories/worker-runtime';
import { storage } from '@mvs/storage';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { JobProcessorService } from './job-processor.service.js';
import { OutboxService } from './outbox.service.js';

@Injectable()
export class WorkerRuntimeService implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;

  private worker?: Worker;

  private interval?: ReturnType<typeof setInterval>;

  private maintenanceTask?: Promise<void>;

  private closing = false;

  constructor(
    @Inject(WorkerRuntimeRepository)
    private readonly repository: WorkerRuntimeRepository,
    @Inject(JobProcessorService)
    private readonly processor: JobProcessorService,
    @Inject(OutboxService)
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit() {
    const url = new URL(process.env.REDIS_URL!);
    const connection = { host: url.hostname, port: Number(url.port), password: url.password || undefined, maxRetriesPerRequest: null };
    const queueName = process.env.MVS_QUEUE_NAME || 'mvs';

    this.queue = new Queue(queueName, { connection });
    this.worker = new Worker(queueName, (task) => this.processor.processJob(task.data.jobId), {
      connection,
      concurrency: 1,
      lockDuration: 60000,
      stalledInterval: 30000,
    });
    this.worker.on('error', (error) => console.error(JSON.stringify({ stage: 'queue', errorType: error.name })));
    this.interval = setInterval(() => this.tick(), 2000);
    this.tick();
  }

  private tick() {
    if (this.closing || this.maintenanceTask) {
      return;
    }

    this.maintenanceTask = this.maintenance()
      .catch((error) => console.error(JSON.stringify({ stage: 'maintenance', errorType: error.name })))
      .finally(() => {
        this.maintenanceTask = undefined;
      });
  }

  async maintenance() {
    await this.outbox.dispatch(this.queue!);
    const stale = await this.repository.maintenanceJobFindMany(new Date(Date.now() - 60000));

    for (const j of stale) {
      await fetch(process.env.AI_URL + '/cancel/' + j.id, {
        method: 'POST',
        headers: { 'X-AI-Secret': process.env.AI_SECRET! },
        signal: AbortSignal.timeout(5000),
      });
      await this.repository.maintenanceJobUpdateMany(j.id, j.attemptToken);
    }

    await this.repository.maintenanceJobUpdateMany2();
    for (const p of await this.repository.maintenanceProjectFindMany()) {
      const running = await this.repository.maintenanceJobCount(p.id);

      if (!running) {
        await storage.removeProject(p.id);
      }
    }
  }

  async onModuleDestroy() {
    this.closing = true;
    clearInterval(this.interval);
    await this.maintenanceTask;
    await this.worker?.close();
    await this.queue?.close();
  }
}
