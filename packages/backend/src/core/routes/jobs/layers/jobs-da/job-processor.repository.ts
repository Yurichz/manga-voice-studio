import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import type { Prisma } from '@mvs/database';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class JobProcessorRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  processJobJobUpdateMany(
    value1: string,
    value2: Prisma.InputJsonValue,
    value3: `${string}-${string}-${string}-${string}-${string}`,
    value4: Date,
  ) {
    return this.$.job.updateMany({
      where: { id: value1, status: 'queued' },
      data: {
        status: 'running',
        stage: 'preparing',
        progress: value2,
        error: null,
        attemptToken: value3,
        attempts: { increment: 1 },
        heartbeatAt: value4,
      },
    });
  }

  processJobJobFindUniqueOrThrow(value1: string) {
    return this.$.job.findUniqueOrThrow({ where: { id: value1 } });
  }

  processJobJobFindUnique(value1: string) {
    return this.$.job.findUnique({ where: { id: value1 } });
  }

  processJobJobFindUnique2(value1: string) {
    return this.$.job.findUnique({ where: { id: value1 }, include: { project: true } });
  }

  processJobJobUpdateMany2(value1: string, value2: `${string}-${string}-${string}-${string}-${string}`) {
    return this.$.job.updateMany({
      where: { id: value1, attemptToken: value2, status: 'cancel_requested' },
      data: { status: 'cancelled', stage: 'cancelled' },
    });
  }

  processJobJobUpdateMany3(value1: string, value2: `${string}-${string}-${string}-${string}-${string}`, value3: Date) {
    return this.$.job.updateMany({ where: { id: value1, attemptToken: value2, status: 'running' }, data: { heartbeatAt: value3 } });
  }

  processJobProjectFindFirst(value1: string, value2: string) {
    return this.$.project.findFirst({ where: { id: value1, ownerId: value2, deletedAt: null } });
  }

  processJobJobFindUnique3(value1: string) {
    return this.$.job.findUnique({ where: { id: value1 } });
  }

  processJobJobUpdateMany4(
    value1: string,
    value2: `${string}-${string}-${string}-${string}-${string}`,
    value3: string,
    value4: 'queued' | 'blocked' | 'cancelled' | 'failed',
    value5: any,
  ) {
    return this.$.job.updateMany({
      where: { id: value1, attemptToken: value2, status: { in: ['running', 'cancel_requested'] } },
      data: { status: value3, stage: value4, error: value5 },
    });
  }

  processJobJobFindUnique4(value1: string) {
    return this.$.job.findUnique({ where: { id: value1 } });
  }
}
