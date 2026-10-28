import { AccessService } from '@mvs/backend/access';
import { ApiError, idempotencySchema } from '@mvs/backend/common';
import { JobEnqueueClService } from '@mvs/backend/jobs';
import { JobsRepository } from '@mvs/backend/repositories/jobs';
import { activeStatuses, jobProgressResponseSchema, summarizeBatch, terminalStatuses } from '@mvs/contracts';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class JobsService {
  constructor(
    @Inject(JobsRepository)
    private readonly repository: JobsRepository,
    @Inject(AccessService)
    private readonly access: AccessService,
    @Inject(JobEnqueueClService)
    private readonly jobs: JobEnqueueClService,
  ) {}

  async jobProgress(ownerId: string, projectId: string) {
    const p = await this.access.project(ownerId, projectId);
    const where = { projectId: p.id, ownerId: p.ownerId };
    const [active, recent] = await Promise.all([
      this.repository.jobProgressJobFindMany(where, activeStatuses),
      this.repository.jobProgressJobFindMany2(where, terminalStatuses),
    ]);
    const jobs = [...active, ...recent];
    const batchIds = [...new Set(jobs.flatMap((j) => (j.batchId ? [j.batchId] : [])))];
    const members = await this.repository.jobProgressJobFindMany3(where, batchIds);
    const batches = batchIds.map((id) =>
      summarizeBatch(
        id,
        members.filter((j) => j.batchId === id),
      ),
    );
    const publicJobs = jobs.map((j) => {
      const input = j.input as any;

      return {
        id: j.id,
        batchId: j.batchId,
        kind: j.kind,
        status: j.status,
        stage: j.stage,
        progress: j.progress,
        error: j.error,
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString(),
        attempts: j.attempts,
        result: j.result,
        ...(['speech', 'voice_design'].includes(j.kind)
          ? {
            synthesis:
                j.kind === 'speech'
                  ? {
                    modelId: input.canonical?.modelId,
                    modelRevision: input.canonical?.modelRevision,
                    adapterVersion: input.canonical?.adapterVersion,
                    generationSettings: input.canonical?.settings,
                    cloningMode: input.canonical?.cloningMode,
                    synthesisText: input.canonical?.synthesisText,
                    textPreparationVersion: input.canonical?.textPreparationVersion,
                  }
                  : {
                    modelId: input.modelId || 'Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign',
                    modelRevision: input.modelRevision || '5ecdb67327fd37bb2e042aab12ff7391903235d3',
                    adapterVersion: input.adapterVersion,
                    generationSettings: input.generationSettings,
                  },
          }
          : {}),
        ...(j.kind === 'voice_design' ? { description: input.description, transcript: input.transcript, name: input.name } : {}),
      };
    });

    return jobProgressResponseSchema.parse({ jobs: publicJobs, batches });
  }

  async listJobs(ownerId: string, projectId: string) {
    const p = await this.access.project(ownerId, projectId);

    return await this.repository.listJobsJobFindMany(p.id);
  }

  async getJob(ownerId: string, jobId: string) {
    const j = await this.repository.getJobJobFindUnique(jobId);

    if (!j || j.ownerId !== ownerId) {
      throw new ApiError(404, 'Задание не найдено');
    }

    await this.access.project(j.ownerId, j.projectId);

    return j;
  }

  async cancelJob(ownerId: string, jobId: string) {
    const j = await this.repository.cancelJobJobFindUnique(jobId);

    if (!j || j.ownerId !== ownerId) {
      throw new ApiError(404, 'Задание не найдено');
    }

    await this.access.project(j.ownerId, j.projectId);
    await this.repository.cancelJobJobUpdateMany(j.id);

    return { status: 'cancel_requested' };
  }

  async retryJob(ownerId: string, jobId: string, input: any, idempotencyKey: string | undefined) {
    const j = await this.repository.retryJobJobFindUnique(jobId);

    if (!j || j.ownerId !== ownerId) {
      throw new ApiError(404, 'Задание не найдено');
    }

    await this.access.project(j.ownerId, j.projectId);
    if (!['failed', 'blocked', 'cancelled'].includes(j.status)) {
      throw new ApiError(422, 'Повтор недоступен');
    }

    const fresh = (
      await this.jobs.enqueue(
        j.ownerId,
        j.projectId,
        j.kind,
        [{ input: j.input, key: idempotencySchema.parse(idempotencyKey) }],
        j.batchId || undefined,
        j.status === 'blocked' ? j.id : undefined,
      )
    )[0];

    return { jobId: fresh.id };
  }
}
