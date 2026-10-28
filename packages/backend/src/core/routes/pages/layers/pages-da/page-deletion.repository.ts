import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import type { Prisma } from '@mvs/database';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class PageDeletionRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  deletePagesSqlQueryRaw(value1: string) {
    return this.$.$queryRaw`SELECT id FROM "Project" WHERE id=${value1} FOR UPDATE`;
  }

  deletePagesProjectFindFirst(value1: string, value2: string) {
    return this.$.project.findFirst({ where: { id: value1, ownerId: value2, deletedAt: null } });
  }

  deletePagesPageFindMany(value1: { id: { in: string[] }; chapterId: string; projectId: string }) {
    return this.$.page.findMany({ where: value1 });
  }

  deletePagesJobUpdateMany(
    value1: {
      projectId: string;
      ownerId: string;
      OR: ({ input: { path: string[]; equals: string } } | { kind: string; input: { path: string[]; equals: string } })[];
    },
    value2: Prisma.InputJsonValue,
  ) {
    return this.$.job.updateMany({
      where: { ...value1, status: { in: ['queued', 'blocked'] } },
      data: { status: 'cancelled', stage: 'cancelled', progress: value2 },
    });
  }

  deletePagesJobUpdateMany2(value1: {
    projectId: string;
    ownerId: string;
    OR: ({ input: { path: string[]; equals: string } } | { kind: string; input: { path: string[]; equals: string } })[];
  }) {
    return this.$.job.updateMany({ where: { ...value1, status: 'running' }, data: { status: 'cancel_requested' } });
  }

  deletePagesUtteranceDeleteMany(value1: string[], value2: string) {
    return this.$.utterance.deleteMany({ where: { pageId: { in: value1 }, projectId: value2 } });
  }

  deletePagesPageDeleteMany(value1: { id: { in: string[] }; chapterId: string; projectId: string }) {
    return this.$.page.deleteMany({ where: value1 });
  }

  deletePagesPageFindMany2(value1: string) {
    return this.$.page.findMany({ where: { chapterId: value1 }, orderBy: { order: 'asc' } });
  }

  deletePagesPageUpdate(value1: string, value2: number) {
    return this.$.page.update({ where: { id: value1 }, data: { order: value2 } });
  }

  deletePagesChapterUpdate(value1: string) {
    return this.$.chapter.update({ where: { id: value1 }, data: { revision: { increment: 1 } } });
  }
}
