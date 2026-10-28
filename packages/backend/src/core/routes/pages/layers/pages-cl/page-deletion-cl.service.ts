import { ApiError, json } from '@mvs/backend/common';
import { PrismaService } from '@mvs/backend/prisma';
import { PageDeletionRepository } from '@mvs/backend/repositories/page-deletion';
import { pagesDeleteSchema } from '@mvs/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class PageDeletionClService {
  constructor(
    @Inject(PageDeletionRepository)
    private readonly repository: PageDeletionRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async deletePages(
    ownerId: string,
    chapter: {
      id: string;
      projectId: string;
    },
    pages: z.infer<typeof pagesDeleteSchema>['pages'],
  ) {
    return this.prisma.$txe(async (tx) => {
      // Serialize both single and bulk deletion with page requests and job publication.
      await this.repository.tx(tx).deletePagesSqlQueryRaw(chapter.projectId);
      if (!(await this.repository.tx(tx).deletePagesProjectFindFirst(chapter.projectId, ownerId))) {
        throw new ApiError(404, 'Проект не найден');
      }

      const ids = pages.map((p) => p.id),
        scope = { id: { in: ids }, chapterId: chapter.id, projectId: chapter.projectId };
      const current = await this.repository.tx(tx).deletePagesPageFindMany(scope);

      if (current.length !== pages.length) {
        throw new ApiError(404, 'Одна из страниц не найдена в этой главе');
      }

      if (pages.some((p) => current.find((c) => c.id === p.id)!.revision !== p.expectedRevision)) {
        throw new ApiError(409, 'Версия страницы изменилась. Обновите список и повторите удаление.');
      }

      const affected = {
        projectId: chapter.projectId,
        ownerId,
        OR: [
          ...ids.map((id) => ({ input: { path: ['pageId'], equals: id } })),
          { kind: 'render', input: { path: ['chapterId'], equals: chapter.id } },
        ],
      };
      const waiting = await this.repository
        .tx(tx)
        .deletePagesJobUpdateMany(affected, json({ phase: 'cancelled', updatedAt: new Date().toISOString() }));
      const running = await this.repository.tx(tx).deletePagesJobUpdateMany2(affected);

      await this.repository.tx(tx).deletePagesUtteranceDeleteMany(ids, chapter.projectId);
      await this.repository.tx(tx).deletePagesPageDeleteMany(scope);
      const remaining = await this.repository.tx(tx).deletePagesPageFindMany2(chapter.id);

      for (const [order, p] of remaining.entries()) {
        if (p.order !== order) {
          await this.repository.tx(tx).deletePagesPageUpdate(p.id, order);
        }
      }

      await this.repository.tx(tx).deletePagesChapterUpdate(chapter.id);

      return waiting.count + running.count;
    });
  }
}
