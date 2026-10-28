import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import type { Prisma } from '@mvs/database';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AnalysisRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  analysePageChapterFindUnique(value1: string) {
    return this.$.chapter.findUnique({ where: { id: value1 } });
  }

  listAnalysesAnalysisRunFindMany(value1: string) {
    return this.$.analysisRun.findMany({ where: { pageId: value1 }, orderBy: { createdAt: 'desc' } });
  }

  applyAnalysisAnalysisRunFindUnique(value1: string) {
    return this.$.analysisRun.findUnique({ where: { id: value1 } });
  }

  applyAnalysisPageUpdateMany(value1: string, value2: number) {
    return this.$.page.updateMany({ where: { id: value1, revision: value2 }, data: { revision: { increment: 1 } } });
  }

  applyAnalysisPanelCreateMany(
    value1: {
      id: `${string}-${string}-${string}-${string}-${string}`;
      pageId: string;
      projectId: string;
      bbox: Prisma.InputJsonValue;
      order: number;
      source: string;
    }[],
  ) {
    return this.$.panel.createMany({ data: value1 });
  }

  applyAnalysisUtteranceCreate(
    value1: `${string}-${string}-${string}-${string}-${string}`,
    value2: string,
    value3: string,
    value4: Prisma.InputJsonValue,
    value5: number,
    value6: 'dialogue' | 'thought' | 'narration' | 'sfx',
    value7: string,
    value8: string,
    value9: boolean,
    value10: number,
  ) {
    return this.$.utterance.create({
      data: {
        id: value1,
        pageId: value2,
        projectId: value3,
        bbox: value4,
        order: value5,
        kind: value6,
        originalText: value7,
        spokenText: value8,
        included: value9,
        revision: value10,
      },
    });
  }

  applyAnalysisAnalysisRunUpdate(value1: string) {
    return this.$.analysisRun.update({ where: { id: value1 }, data: { status: 'applied' } });
  }

  applyAnalysisChapterUpdate(value1: string) {
    return this.$.chapter.update({ where: { id: value1 }, data: { revision: { increment: 1 } } });
  }
}
