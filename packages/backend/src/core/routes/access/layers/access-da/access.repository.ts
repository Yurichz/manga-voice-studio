import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AccessRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  projectProjectFindFirst(value1: string, value2: string) {
    return this.$.project.findFirst({ where: { id: value1, ownerId: value2, deletedAt: null } });
  }

  pagePageFindUnique(value1: string) {
    return this.$.page.findUnique({
      where: { id: value1 },
      include: { panels: { orderBy: { order: 'asc' } }, utterances: { orderBy: { order: 'asc' } } },
    });
  }
}
