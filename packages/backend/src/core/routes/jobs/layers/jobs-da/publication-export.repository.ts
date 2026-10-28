import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class PublicationExportRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  handleJobFindUnique(value1: any) {
    return this.$.job.findUnique({ where: { id: value1 } });
  }

  handleProjectFindUniqueOrThrow(value1: string) {
    return this.$.project.findUniqueOrThrow({ where: { id: value1 } });
  }

  handleChapterFindMany(value1: any) {
    return this.$.chapter.findMany({ where: { id: { in: value1 } } });
  }
}
