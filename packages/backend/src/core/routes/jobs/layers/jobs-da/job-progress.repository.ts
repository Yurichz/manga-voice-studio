import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import type { Prisma } from '@mvs/database';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class JobProgressRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  writeJobUpdateMany(value1: string, value2: string, value3: string, value4: Prisma.InputJsonValue) {
    return this.$.job.updateMany({
      where: { id: value1, attemptToken: value2, status: 'running' },
      data: { stage: value3, progress: value4 },
    });
  }
}
