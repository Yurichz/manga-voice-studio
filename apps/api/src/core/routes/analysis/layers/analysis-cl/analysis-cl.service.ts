import { AccessService } from '@mvs/backend/access';
import { ApiError, json } from '@mvs/backend/common';
import { PrismaService } from '@mvs/backend/prisma';
import { AnalysisRepository } from '@mvs/backend/repositories/analysis';
import { analysisSchema } from '@mvs/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { type ApplyAnalysisDto } from '../../dto/analysis.dto.js';

@Injectable()
export class AnalysisClService {
  constructor(
    @Inject(AnalysisRepository)
    private readonly repository: AnalysisRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AccessService)
    private readonly access: AccessService,
  ) {}

  async applyAnalysis(ownerId: string, analysisId: string, input: ApplyAnalysisDto) {
    const a = await this.repository.applyAnalysisAnalysisRunFindUnique(analysisId);

    if (!a) {
      throw new ApiError(404, 'Анализ не найден');
    }

    const p = await this.access.page(ownerId, a.pageId);
    const v = input;
    const proposal = analysisSchema.parse(a.proposal);

    if (p.revision !== a.inputRevision || p.revision !== v.expectedRevision || a.status !== 'proposed') {
      throw new ApiError(409, 'Предложение устарело или уже применено');
    }

    await this.prisma.$txe(async (tx) => {
      const n = await this.repository.tx(tx).applyAnalysisPageUpdateMany(p.id, v.expectedRevision);

      if (!n.count) {
        throw new ApiError(409, 'Версия страницы изменилась');
      }

      if (v.includePanels) {
        await this.repository.tx(tx).applyAnalysisPanelCreateMany(
          proposal.panels.map((x, i) => ({
            id: randomUUID(),
            pageId: p.id,
            projectId: p.projectId,
            bbox: json(x.bbox),
            order: p.panels.length + i,
            source: 'ai',
          })),
        );
      }

      for (const i of [...new Set(v.utteranceIndices)]) {
        const u = proposal.utterances[i];

        if (!u) {
          throw new ApiError(422, 'Некорректный элемент');
        }

        await this.repository
          .tx(tx)
          .applyAnalysisUtteranceCreate(
            randomUUID(),
            p.id,
            p.projectId,
            json(u.bbox),
            p.utterances.length + i,
            u.kind,
            u.text,
            u.text,
            u.kind !== 'sfx',
            p.revision + 1,
          );
      }

      await this.repository.tx(tx).applyAnalysisAnalysisRunUpdate(a.id);
      await this.repository.tx(tx).applyAnalysisChapterUpdate(p.chapterId);
    });

    return await this.access.page(ownerId, p.id);
  }
}
