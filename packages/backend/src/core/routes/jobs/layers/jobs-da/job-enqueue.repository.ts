import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import type { Prisma } from '@mvs/database';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class JobEnqueueRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  enqueueSqlQueryRaw(value1: string) {
    return this.$.$queryRaw`SELECT id FROM "User" WHERE id=${value1} FOR UPDATE`;
  }

  enqueueSqlQueryRaw2(value1: string) {
    return this.$.$queryRaw`SELECT id FROM "Project" WHERE id=${value1} FOR UPDATE`;
  }

  enqueuePageFindFirst(value1: any, value2: string) {
    return this.$.page.findFirst({ where: { id: value1, projectId: value2 } });
  }

  enqueueJobUpdateMany(value1: string, value2: string, value3: string) {
    return this.$.job.updateMany({
      where: { id: value1, ownerId: value2, projectId: value3, status: 'blocked' },
      data: { status: 'cancelled', stage: 'cancelled' },
    });
  }

  enqueueJobCount(value1: string, value2: string, value3: string[]) {
    return this.$.job.count({ where: { projectId: value1, kind: value2, idempotencyKey: { in: value3 } } });
  }

  enqueueJobCount2(value1: string) {
    return this.$.job.count({ where: { ownerId: value1, status: { in: ['queued', 'running', 'blocked', 'cancel_requested'] } } });
  }

  enqueueJobUpsert(
    value1: string,
    value2: string,
    value3: string,
    value4: string,
    value5: string,
    value6: string,
    value7: Prisma.InputJsonValue,
    value8: string,
    value9: string | undefined,
  ) {
    return this.$.job.upsert({
      where: { projectId_kind_idempotencyKey: { projectId: value1, kind: value2, idempotencyKey: value3 } },
      create: { ownerId: value4, projectId: value5, kind: value6, input: value7, idempotencyKey: value8, batchId: value9 },
      update: {},
    });
  }

  enqueueOutboxEventUpsert(value1: string, value2: string) {
    return this.$.outboxEvent.upsert({ where: { jobId: value1 }, create: { jobId: value2 }, update: {} });
  }
}
