import { AiService } from '@mvs/backend/ai';
import { json } from '@mvs/backend/common';
import { JobProgressService } from '@mvs/backend/jobs';
import { JobProcessorRepository } from '@mvs/backend/repositories/job-processor';
import { jobResultSchema, progressSchema, type JobProgress } from '@mvs/contracts';
import { storage } from '@mvs/storage';
import { Inject, Injectable } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { JOB_HANDLERS, type JobHandler } from '../../interfaces/job-context.js';
import { JobPublicationClService } from '../jobs-cl/job-publication-cl.service.js';

@Injectable()
export class JobProcessorService {
  constructor(
    @Inject(JobProcessorRepository)
    private readonly repository: JobProcessorRepository,
    @Inject(JOB_HANDLERS)
    private readonly handlers: JobHandler[],
    @Inject(JobPublicationClService)
    private readonly publication: JobPublicationClService,
    @Inject(JobProgressService)
    private readonly progress: JobProgressService,
    @Inject(AiService)
    private readonly ai: AiService,
  ) {}

  async processJob(jobId: string) {
    const token = randomUUID();
    const claimed = await this.repository.processJobJobUpdateMany(
      jobId,
      json({ phase: 'preparing', updatedAt: new Date().toISOString() }),
      token,
      new Date(),
    );

    if (!claimed.count) {
      return;
    }

    const j = await this.repository.processJobJobFindUniqueOrThrow(jobId);
    const v = j.input as any;
    let result: any;
    let extra: any;
    let writes = Promise.resolve(),
      aiEpoch = 0,
      sequence = 0,
      heartbeatBusy = false;
    const seen = new Set(['queued']);
    let lastPhase = 'preparing';
    const report = (value: JobProgress, epoch?: number) => {
      writes = writes.then(async () => {
        if (epoch !== undefined && epoch !== aiEpoch) {
          return;
        }

        seen.add(lastPhase);
        for (const p of value.completedPhases || []) {
          seen.add(p);
        }

        lastPhase = value.phase;
        const n = await this.progress.write(jobId, token, { ...value, completedPhases: [...seen].filter((p) => p !== value.phase) });

        if (!n.count && epoch === undefined) {
          throw new UnrecoverableError('Задание отменено или попытка завершена');
        }
      });

      return writes;
    };
    const phase = (name: string, completed?: number, total?: number, unit?: JobProgress['unit']) =>
      report({ phase: name, updatedAt: new Date().toISOString(), ...(completed === undefined ? {} : { completed, total, unit }) });
    const runAI = async (kind: string, input: unknown) => {
      const current = await this.repository.processJobJobFindUnique(jobId);

      if (current?.status !== 'running' || current.attemptToken !== token) {
        throw new UnrecoverableError('Задание отменено');
      }

      aiEpoch = ++sequence;
      try {
        const { runtimeProgress, ...result } = await this.ai.run(jobId, kind, input, token);
        const parsed = progressSchema.safeParse(runtimeProgress);

        if (parsed.success) {
          await report(parsed.data, aiEpoch);
        }

        return jobResultSchema.parse(result);
      } finally {
        aiEpoch = 0;
        await writes;
      }
    };
    const heartbeat = setInterval(() => {
      if (heartbeatBusy) {
        return;
      }

      heartbeatBusy = true;
      void (async () => {
        const current = await this.repository.processJobJobFindUnique2(jobId);

        if (!current || current.attemptToken !== token) {
          return;
        }

        if (current.status === 'cancel_requested' || current.project.deletedAt) {
          const cancellation = await fetch(process.env.AI_URL + '/cancel/' + jobId, {
            method: 'POST',
            headers: { 'X-AI-Secret': process.env.AI_SECRET! },
            signal: AbortSignal.timeout(5000),
          }).catch(() => null);

          if (cancellation?.ok) {
            await this.repository.processJobJobUpdateMany2(jobId, token);
          }
        } else if (current.status === 'running') {
          await this.repository.processJobJobUpdateMany3(jobId, token, new Date());
          const epoch = aiEpoch;

          if (epoch) {
            const r = await fetch(process.env.AI_URL + '/progress/' + jobId + '?attemptToken=' + encodeURIComponent(token), {
              headers: { 'X-AI-Secret': process.env.AI_SECRET! },
              signal: AbortSignal.timeout(1500),
            });

            if (r.ok) {
              const data = (await r.json()) as any;
              const parsed = progressSchema.safeParse(data.progress);

              if (parsed.success) {
                await report(parsed.data, epoch);
              }
            }
          }
        }
      })()
        .catch(() => {})
        .finally(() => {
          heartbeatBusy = false;
        });
    }, 2000);

    try {
      const p = await this.repository.processJobProjectFindFirst(j.projectId, j.ownerId);

      if (!p) {
        throw new UnrecoverableError('Проект удалён');
      }

      await phase('preparing');
      ({ result, extra } =
        (await this.handlers
          .find((handler) => handler.kinds.includes(j.kind))
          ?.handle({ job: j, input: v, project: p, token, phase, runAI })) ??
        (() => {
          throw new UnrecoverableError('Unsupported job type');
        })());
      await phase('publishing');
      await this.publication.publish(j, v, result, extra, token, seen);
    } catch (e: any) {
      const current = await this.repository.processJobJobFindUnique3(jobId);
      const retryable = (e.status >= 500 && e.status !== 503) || ['TypeError', 'TimeoutError', 'AbortError'].includes(e.name);
      const status =
        current?.status === 'cancel_requested' || current?.status === 'cancelled'
          ? 'cancelled'
          : e.status === 503
            ? 'blocked'
            : retryable && j.attempts < 3
              ? 'queued'
              : 'failed';

      await this.repository.processJobJobUpdateMany4(jobId, token, status, status, e.message?.slice(0, 400));
      console.error(JSON.stringify({ jobId, stage: status, errorType: e.name }));
      if (status === 'queued') {
        throw e;
      }

      throw new UnrecoverableError(e.message);
    } finally {
      clearInterval(heartbeat);
      const state = await this.repository.processJobJobFindUnique4(jobId);

      if (['succeeded', 'cancelled'].includes(state?.status || '')) {
        if (j.kind === 'import') {
          for (const f of v.files) {
            await fs.rm(storage.resolve(f.key), { force: true }).catch(() => {});
          }
        }

        if (j.kind === 'replace_page') {
          await fs.rm(storage.resolve(v.fileKey), { force: true }).catch(() => {});
        }
      }
    }
  }
}
