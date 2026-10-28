import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class ChaptersRepository extends TxScopeRepository {
  countChapters(projectId: string) {
    return this.$.chapter.count({ where: { projectId } });
  }

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  createChapterChapterCreate(value1: string, value2: string, value3: number) {
    return this.$.chapter.create({ data: { projectId: value1, title: value2, order: value3 } });
  }

  getChapterChapterFindUnique(value1: string) {
    return this.$.chapter.findUnique({
      where: { id: value1 },
      include: { pages: { orderBy: { order: 'asc' } }, renders: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
  }

  updateChapterChapterFindUnique(value1: string) {
    return this.$.chapter.findUnique({ where: { id: value1 } });
  }

  updateChapterSqlQueryRaw(value1: string) {
    return this.$.$queryRaw`SELECT id FROM "Project" WHERE id=${value1} FOR UPDATE`;
  }

  updateChapterChapterUpdateMany(value1: string, value2: number, value3: string | undefined, value4: 'rtl' | 'ltr' | null | undefined) {
    return this.$.chapter.updateMany({
      where: { id: value1, revision: value2 },
      data: { title: value3, readingDirection: value4, revision: { increment: 1 } },
    });
  }

  updateChapterPageFindMany(value1: string) {
    return this.$.page.findMany({ where: { chapterId: value1 } });
  }

  updateChapterPageUpdate(value1: string, value2: number) {
    return this.$.page.update({ where: { id: value1 }, data: { order: value2 } });
  }

  importChapterChapterFindUnique(value1: string) {
    return this.$.chapter.findUnique({ where: { id: value1 } });
  }
}
