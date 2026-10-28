import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class WorkerRuntimeRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  maintenanceJobFindMany(value1: Date) {
    return this.$.job.findMany({ where: { status: 'running', heartbeatAt: { lt: value1 } } });
  }

  maintenanceJobUpdateMany(value1: string, value2: string | null) {
    return this.$.job.updateMany({
      where: { id: value1, status: 'running', attemptToken: value2 },
      data: { status: 'failed', stage: 'failed', error: 'Воркер перестал отвечать. Повторите задание.', attemptToken: null },
    });
  }

  maintenanceJobUpdateMany2() {
    return this.$.job.updateMany({
      where: { status: 'cancel_requested', attemptToken: null },
      data: { status: 'cancelled', stage: 'cancelled' },
    });
  }

  maintenanceProjectFindMany() {
    return this.$.project.findMany({ where: { deletedAt: { not: null } } });
  }

  maintenanceJobCount(value1: string) {
    return this.$.job.count({ where: { projectId: value1, status: { in: ['running', 'cancel_requested'] } } });
  }
}
