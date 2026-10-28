import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import type { Prisma } from '@mvs/database';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class PagesRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  updatePageSqlQueryRaw(value1: string) {
    return this.$.$queryRaw`SELECT id FROM "Project" WHERE id=${value1} FOR UPDATE`;
  }

  updatePagePageUpdateMany(value1: string, value2: number) {
    return this.$.page.updateMany({ where: { id: value1, revision: value2 }, data: { revision: { increment: 1 } } });
  }

  updatePageCharacterFindMany(value1: string) {
    return this.$.character.findMany({ where: { projectId: value1 } });
  }

  updatePageVoiceProfileVersionFindMany(value1: string) {
    return this.$.voiceProfileVersion.findMany({ where: { projectId: value1 } });
  }

  updatePageUtteranceCount(value1: string[], value2: string) {
    return this.$.utterance.count({ where: { id: { in: value1 }, pageId: { not: value2 } } });
  }

  updatePagePanelCount(value1: string[], value2: string) {
    return this.$.panel.count({ where: { id: { in: value1 }, pageId: { not: value2 } } });
  }

  updatePageUtteranceDeleteMany(value1: string, value2: string[]) {
    return this.$.utterance.deleteMany({ where: { pageId: value1, id: { notIn: value2 } } });
  }

  updatePageUtteranceUpdateMany(value1: string, value2: string[]) {
    return this.$.utterance.updateMany({ where: { pageId: value1, panelId: { notIn: value2 } }, data: { panelId: null } });
  }

  updatePagePanelDeleteMany(value1: string, value2: string[]) {
    return this.$.panel.deleteMany({ where: { pageId: value1, id: { notIn: value2 } } });
  }

  updatePagePanelUpdateMany(
    value1: string,
    value2: string,
    value3: string,
    value4: { bbox: Prisma.InputJsonValue; order: number; source: 'ai' | 'manual' },
  ) {
    return this.$.panel.updateMany({ where: { id: value1, pageId: value2, projectId: value3 }, data: value4 });
  }

  updatePagePanelCreate(
    value1: string,
    value2: string,
    value3: string,
    value4: { bbox: Prisma.InputJsonValue; order: number; source: 'ai' | 'manual' },
  ) {
    return this.$.panel.create({ data: { id: value1, pageId: value2, projectId: value3, ...value4 } });
  }

  updatePageUtteranceUpdateMany2(
    value1: string,
    value2: string,
    value3: string,
    value4: {
      activeAudioId?: null | undefined;
      bbox: Prisma.InputJsonValue;
      revision: number;
      id: string;
      panelId: string | null;
      order: number;
      kind: 'dialogue' | 'thought' | 'narration' | 'sfx';
      originalText: string;
      spokenText: string;
      characterId: string | null;
      voiceVersionId: string | null;
      pauseMs: number;
      included: boolean;
      reviewStatus: 'unreviewed' | 'reviewed';
    },
  ) {
    return this.$.utterance.updateMany({ where: { id: value1, pageId: value2, projectId: value3 }, data: value4 });
  }

  updatePageUtteranceCreate(
    value1: {
      activeAudioId?: null | undefined;
      bbox: Prisma.InputJsonValue;
      revision: number;
      id: string;
      panelId: string | null;
      order: number;
      kind: 'dialogue' | 'thought' | 'narration' | 'sfx';
      originalText: string;
      spokenText: string;
      characterId: string | null;
      voiceVersionId: string | null;
      pauseMs: number;
      included: boolean;
      reviewStatus: 'unreviewed' | 'reviewed';
    },
    value2: string,
    value3: string,
  ) {
    return this.$.utterance.create({ data: { ...value1, pageId: value2, projectId: value3 } });
  }

  updatePageChapterUpdate(value1: string) {
    return this.$.chapter.update({ where: { id: value1 }, data: { revision: { increment: 1 } } });
  }

  deleteChapterPagesChapterFindUnique(value1: string) {
    return this.$.chapter.findUnique({ where: { id: value1 } });
  }
}
