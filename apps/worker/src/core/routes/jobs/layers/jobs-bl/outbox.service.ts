import { OutboxRepository } from '@mvs/backend/repositories/outbox';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class OutboxService {
  constructor(
    @Inject(OutboxRepository)
    private readonly repository: OutboxRepository,
  ) {}

  async dispatch(queue: Queue) {
    const events = await this.repository.dispatchOutboxEventFindMany();

    for (const e of events) {
      await queue.add(
        e.job.kind,
        { jobId: e.jobId },
        {
          jobId: e.jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          priority: e.job.kind === 'voice_design' || (e.job.input as any).preview ? 1 : 5,
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
      await this.repository.dispatchOutboxEventUpdate(e.id, new Date());
    }
  }
}
