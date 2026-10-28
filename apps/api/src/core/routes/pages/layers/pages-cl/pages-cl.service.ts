import { AccessService } from '@mvs/backend/access';
import { ApiError, json } from '@mvs/backend/common';
import { PrismaService } from '@mvs/backend/prisma';
import { PagesRepository } from '@mvs/backend/repositories/pages';
import { utteranceSchema } from '@mvs/contracts';
import { inputHash } from '@mvs/contracts/server';
import { Inject, Injectable } from '@nestjs/common';
import { type UpdatePageDto } from '../../dto/pages.dto.js';

@Injectable()
export class PagesClService {
  constructor(
    @Inject(PagesRepository)
    private readonly repository: PagesRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AccessService)
    private readonly access: AccessService,
  ) {}

  async updatePage(ownerId: string, pageId: string, input: UpdatePageDto) {
    const p = await this.access.page(ownerId, pageId);
    const v = input;

    await this.prisma.$txe(async (tx) => {
      await this.repository.tx(tx).updatePageSqlQueryRaw(p.projectId);
      const n = await this.repository.tx(tx).updatePagePageUpdateMany(p.id, v.expectedRevision);

      if (!n.count) {
        throw new ApiError(409, 'Страница изменена в другом окне. Черновик сохранён локально.');
      }

      const chars = await this.repository.tx(tx).updatePageCharacterFindMany(p.projectId),
        voices = await this.repository.tx(tx).updatePageVoiceProfileVersionFindMany(p.projectId);

      for (const u of v.utterances) {
        if (
          (u.characterId && !chars.some((c) => c.id === u.characterId)) ||
          (u.voiceVersionId && !voices.some((x) => x.id === u.voiceVersionId))
        ) {
          throw new ApiError(422, 'Персонаж или голос другого проекта');
        }
      }

      const foreign = await this.repository.tx(tx).updatePageUtteranceCount(
        v.utterances.map((x) => x.id),
        p.id,
      );
      const foreignPanels = await this.repository.tx(tx).updatePagePanelCount(
        v.panels.map((x) => x.id),
        p.id,
      );

      if (foreign || foreignPanels) {
        throw new ApiError(422, 'Идентификатор принадлежит другой странице');
      }

      await this.repository.tx(tx).updatePageUtteranceDeleteMany(
        p.id,
        v.utterances.map((x) => x.id),
      );
      await this.repository.tx(tx).updatePageUtteranceUpdateMany(
        p.id,
        v.panels.map((x) => x.id),
      );
      await this.repository.tx(tx).updatePagePanelDeleteMany(
        p.id,
        v.panels.map((x) => x.id),
      );
      for (const x of v.panels) {
        const old = p.panels.find((y) => y.id === x.id);
        const data = { bbox: json(x.bbox), order: x.order, source: x.source };

        if (old) {
          await this.repository.tx(tx).updatePagePanelUpdateMany(x.id, p.id, p.projectId, data);
        } else {
          await this.repository.tx(tx).updatePagePanelCreate(x.id, p.id, p.projectId, data);
        }
      }

      for (const x of v.utterances) {
        const old = p.utterances.find((y) => y.id === x.id);
        const { revision: _incomingRevision, ...edit } = x;
        const oldEdit = old ? utteranceSchema.omit({ revision: true }).parse(old) : null;
        const changed = !old || inputHash(edit) !== inputHash(oldEdit);
        const audioChanged = !old || old.spokenText !== x.spokenText || old.voiceVersionId !== x.voiceVersionId;
        const data = {
          ...edit,
          bbox: json(x.bbox),
          revision: old ? old.revision + (changed ? 1 : 0) : 0,
          ...(audioChanged ? { activeAudioId: null } : {}),
        };

        if (old) {
          await this.repository.tx(tx).updatePageUtteranceUpdateMany2(x.id, p.id, p.projectId, data);
        } else {
          await this.repository.tx(tx).updatePageUtteranceCreate(data, p.id, p.projectId);
        }
      }

      await this.repository.tx(tx).updatePageChapterUpdate(p.chapterId);
    });

    return await this.access.page(ownerId, p.id);
  }
}
