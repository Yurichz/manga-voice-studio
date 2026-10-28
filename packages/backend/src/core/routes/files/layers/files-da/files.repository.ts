import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class FilesRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  downloadFileChapterRenderFindFirst(value1: string, value2: string, value3: string) {
    return this.$.chapterRender.findFirst({
      where: { projectId: value1, OR: [{ fileKey: value2 }, { manifest: { path: ['zipKey'], equals: value3 } }] },
      include: { chapter: true },
    });
  }

  downloadFileJobFindFirst(value1: string, value2: string) {
    return this.$.job.findFirst({
      where: { projectId: value1, kind: 'publication_export', status: 'succeeded', result: { path: ['fileKey'], equals: value2 } },
    });
  }
}
