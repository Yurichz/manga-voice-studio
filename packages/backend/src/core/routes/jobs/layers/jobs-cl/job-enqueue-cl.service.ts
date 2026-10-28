import { AccessService } from '@mvs/backend/access';
import { ApiError, json } from '@mvs/backend/common';
import { PrismaService } from '@mvs/backend/prisma';
import { JobEnqueueRepository } from '@mvs/backend/repositories/job-enqueue';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class JobEnqueueClService {
  constructor(
    @Inject(JobEnqueueRepository)
    private readonly repository: JobEnqueueRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AccessService)
    private readonly access: AccessService,
  ) {}

  async enqueue(
    ownerId: string,
    projectId: string,
    kind: string,
    inputs: {
      input: unknown;
      key: string;
    }[],
    batchId?: string,
    replaceBlockedId?: string,
  ) {
    await this.access.project(ownerId, projectId);

    return this.prisma.$txe(async (tx) => {
      await this.repository.tx(tx).enqueueSqlQueryRaw(ownerId);
      await this.repository.tx(tx).enqueueSqlQueryRaw2(projectId);
      for (const { input } of inputs) {
        const pageId = (input as any)?.pageId;

        if (pageId && !(await this.repository.tx(tx).enqueuePageFindFirst(pageId, projectId))) {
          throw new ApiError(404, 'Страница удалена. Задание не может быть запущено.');
        }
      }

      if (replaceBlockedId) {
        await this.repository.tx(tx).enqueueJobUpdateMany(replaceBlockedId, ownerId, projectId);
      }

      const existing = await this.repository.tx(tx).enqueueJobCount(
        projectId,
        kind,
        inputs.map((x) => x.key),
      );
      const pending = await this.repository.tx(tx).enqueueJobCount2(ownerId);

      if (pending + inputs.length - existing > 200) {
        throw new ApiError(429, 'В очереди максимум 200 заданий. Дождитесь завершения или отмените лишние.');
      }

      const jobs = [];

      for (const { input, key } of inputs) {
        const j = await this.repository.tx(tx).enqueueJobUpsert(projectId, kind, key, ownerId, projectId, kind, json(input), key, batchId);

        await this.repository.tx(tx).enqueueOutboxEventUpsert(j.id, j.id);
        jobs.push(j);
      }

      return jobs;
    });
  }

  async job(ownerId: string, projectId: string, kind: string, input: unknown, key: string) {
    return (await this.enqueue(ownerId, projectId, kind, [{ input, key }]))[0];
  }
}
