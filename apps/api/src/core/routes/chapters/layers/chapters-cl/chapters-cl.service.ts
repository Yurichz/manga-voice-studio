import { AccessService } from '@mvs/backend/access';
import { ApiError } from '@mvs/backend/common';
import { PrismaService } from '@mvs/backend/prisma';
import { ChaptersRepository } from '@mvs/backend/repositories/chapters';
import { Inject, Injectable } from '@nestjs/common';
import { type UpdateChapterDto } from '../../dto/chapters.dto.js';

@Injectable()
export class ChaptersClService {
  constructor(
    @Inject(ChaptersRepository)
    private readonly repository: ChaptersRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AccessService)
    private readonly access: AccessService,
  ) {}

  async updateChapter(ownerId: string, chapterId: string, input: UpdateChapterDto) {
    const c = await this.repository.updateChapterChapterFindUnique(chapterId);

    if (!c) {
      throw new ApiError(404, 'Chapter not found');
    }

    await this.access.project(ownerId, c.projectId);
    const v = input;

    await this.prisma.$txe(async (tx) => {
      await this.repository.tx(tx).updateChapterSqlQueryRaw(c.projectId);
      const n = await this.repository.tx(tx).updateChapterChapterUpdateMany(c.id, v.expectedRevision, v.title, v.readingDirection);

      if (!n.count) {
        throw new ApiError(409, 'The chapter revision changed');
      }

      if (v.pageIds) {
        const pages = await this.repository.tx(tx).updateChapterPageFindMany(c.id);

        if (
          v.pageIds.length !== pages.length ||
          new Set(v.pageIds).size !== pages.length ||
          v.pageIds.some((x) => !pages.some((p) => p.id === x))
        ) {
          throw new ApiError(422, 'Invalid page order');
        }

        for (const [order, pid] of v.pageIds.entries()) {
          await this.repository.tx(tx).updateChapterPageUpdate(pid, order);
        }
      }
    });

    return { revision: c.revision + 1 };
  }
}
