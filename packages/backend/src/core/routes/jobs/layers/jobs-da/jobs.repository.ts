import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class JobsRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  jobProgressJobFindMany(value1: { projectId: string; ownerId: string }, value2: string[]) {
    return this.$.job.findMany({ where: { ...value1, status: { in: value2 } }, orderBy: { createdAt: 'desc' } });
  }

  jobProgressJobFindMany2(value1: { projectId: string; ownerId: string }, value2: string[]) {
    return this.$.job.findMany({ where: { ...value1, status: { in: value2 } }, orderBy: { updatedAt: 'desc' }, take: 50 });
  }

  jobProgressJobFindMany3(value1: { projectId: string; ownerId: string }, value2: string[]) {
    return this.$.job.findMany({
      where: { ...value1, batchId: { in: value2 } },
      select: { batchId: true, input: true, status: true, createdAt: true },
    });
  }

  listJobsJobFindMany(value1: string) {
    return this.$.job.findMany({ where: { projectId: value1 }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  getJobJobFindUnique(value1: string) {
    return this.$.job.findUnique({ where: { id: value1 } });
  }

  cancelJobJobFindUnique(value1: string) {
    return this.$.job.findUnique({ where: { id: value1 } });
  }

  cancelJobJobUpdateMany(value1: string) {
    return this.$.job.updateMany({
      where: { id: value1, status: { in: ['queued', 'running', 'blocked'] } },
      data: { status: 'cancel_requested' },
    });
  }

  retryJobJobFindUnique(value1: string) {
    return this.$.job.findUnique({ where: { id: value1 } });
  }
}
