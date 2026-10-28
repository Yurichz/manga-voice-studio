import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import type { Prisma } from '@mvs/database';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class CharactersRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  createCharacterCharacterCreate(value1: { name: string; description: string }, value2: string) {
    return this.$.character.create({ data: { ...value1, projectId: value2 } });
  }

  updateCharacterCharacterFindUnique(value1: string) {
    return this.$.character.findUnique({ where: { id: value1 } });
  }

  updateCharacterVoiceProfileVersionFindFirst(value1: string, value2: string) {
    return this.$.voiceProfileVersion.findFirst({ where: { id: value1, projectId: value2 } });
  }

  updateCharacterCharacterUpdateMany(
    value1: string,
    value2: number,
    value3: { name?: string | undefined; description?: string | undefined; defaultVoiceVersionId?: string | null | undefined },
  ) {
    return this.$.character.updateMany({ where: { id: value1, revision: value2 }, data: { ...value3, revision: { increment: 1 } } });
  }

  updateCharacterChapterUpdateMany(value1: string, value2: string) {
    return this.$.chapter.updateMany({
      where: { projectId: value1, pages: { some: { utterances: { some: { characterId: value2 } } } } },
      data: { revision: { increment: 1 } },
    });
  }

  updateCharacterCharacterFindUnique2(value1: string) {
    return this.$.character.findUnique({ where: { id: value1 } });
  }

  mergeCharacterCharacterFindUnique(value1: string) {
    return this.$.character.findUnique({ where: { id: value1 } });
  }

  mergeCharacterCharacterFindFirst(value1: string, value2: string) {
    return this.$.character.findFirst({ where: { id: value1, projectId: value2 } });
  }

  mergeCharacterVoiceProfileVersionFindFirst(value1: string, value2: string) {
    return this.$.voiceProfileVersion.findFirst({ where: { id: value1, projectId: value2 } });
  }

  mergeCharacterCharacterUpdateMany(value1: string, value2: number) {
    return this.$.character.updateMany({
      where: { id: value1, revision: value2, status: 'active' },
      data: { status: 'merged', revision: { increment: 1 } },
    });
  }

  mergeCharacterCharacterUpdateMany2(value1: string, value2: number, value3: string | null) {
    return this.$.character.updateMany({
      where: { id: value1, revision: value2, status: 'active' },
      data: { defaultVoiceVersionId: value3, revision: { increment: 1 } },
    });
  }

  mergeCharacterUtteranceFindMany(value1: string) {
    return this.$.utterance.findMany({ where: { characterId: value1 }, select: { id: true, revision: true, pageId: true } });
  }

  mergeCharacterCharacterReferenceFindMany(value1: string) {
    return this.$.characterReference.findMany({ where: { characterId: value1 }, select: { id: true } });
  }

  mergeCharacterUtteranceUpdateMany(value1: string, value2: string) {
    return this.$.utterance.updateMany({ where: { characterId: value1 }, data: { characterId: value2, revision: { increment: 1 } } });
  }

  mergeCharacterPageUpdateMany(value1: string[]) {
    return this.$.page.updateMany({ where: { id: { in: value1 } }, data: { revision: { increment: 1 } } });
  }

  mergeCharacterCharacterReferenceUpdateMany(value1: string, value2: string) {
    return this.$.characterReference.updateMany({ where: { characterId: value1 }, data: { characterId: value2 } });
  }

  mergeCharacterChapterUpdateMany(value1: string) {
    return this.$.chapter.updateMany({ where: { projectId: value1 }, data: { revision: { increment: 1 } } });
  }

  mergeCharacterCharacterMergeCreate(
    value1: string,
    value2: string,
    value3: string,
    value4: Prisma.InputJsonValue,
    value5: Prisma.InputJsonValue,
  ) {
    return this.$.characterMerge.create({
      data: { projectId: value1, sourceId: value2, targetId: value3, before: value4, assignments: value5 },
    });
  }

  undoMergeCharacterMergeFindUnique(value1: string) {
    return this.$.characterMerge.findUnique({ where: { id: value1 } });
  }

  undoMergeCharacterMergeUpdateMany(value1: string) {
    return this.$.characterMerge.updateMany({ where: { id: value1, status: 'applied' }, data: { status: 'undone' } });
  }

  undoMergeUtteranceUpdateMany(value1: any, value2: string, value3: any, value4: string) {
    return this.$.utterance.updateMany({
      where: { id: value1, characterId: value2, revision: value3 },
      data: { characterId: value4, revision: { increment: 1 } },
    });
  }

  undoMergePageUpdate(value1: any) {
    return this.$.page.update({ where: { id: value1 }, data: { revision: { increment: 1 } } });
  }

  undoMergeCharacterUpdateMany(value1: string, value2: any) {
    return this.$.character.updateMany({
      where: { id: value1, status: 'merged', revision: value2 },
      data: { status: 'active', revision: { increment: 1 } },
    });
  }

  undoMergeCharacterUpdateMany2(value1: string, value2: any, value3: any) {
    return this.$.character.updateMany({
      where: { id: value1, revision: value2 },
      data: { defaultVoiceVersionId: value3, revision: { increment: 1 } },
    });
  }

  undoMergeCharacterReferenceUpdateMany(value1: any, value2: string, value3: string) {
    return this.$.characterReference.updateMany({ where: { id: value1, characterId: value2 }, data: { characterId: value3 } });
  }

  undoMergeChapterUpdateMany(value1: string) {
    return this.$.chapter.updateMany({ where: { projectId: value1 }, data: { revision: { increment: 1 } } });
  }

  listMergesCharacterMergeFindMany(value1: string) {
    return this.$.characterMerge.findMany({ where: { projectId: value1 }, orderBy: { createdAt: 'desc' } });
  }

  previewMergeCharacterFindUnique(value1: string) {
    return this.$.character.findUnique({ where: { id: value1 } });
  }

  previewMergeUtteranceFindMany(value1: string, value2: string) {
    return this.$.utterance.findMany({
      where: { projectId: value1, characterId: value2 },
      select: { id: true, pageId: true, spokenText: true, voiceVersionId: true },
    });
  }

  deleteReferenceCharacterReferenceFindUnique(value1: string) {
    return this.$.characterReference.findUnique({ where: { id: value1 } });
  }

  deleteReferenceCharacterReferenceDelete(value1: string) {
    return this.$.characterReference.delete({ where: { id: value1 } });
  }

  confirmAppearanceCharacterAppearanceFindUnique(value1: string) {
    return this.$.characterAppearance.findUnique({ where: { id: value1 } });
  }

  confirmAppearanceCharacterFindFirst(value1: string, value2: string) {
    return this.$.character.findFirst({ where: { id: value1, projectId: value2 } });
  }

  confirmAppearanceCharacterAppearanceUpdate(value1: string, value2: string | null) {
    return this.$.characterAppearance.update({ where: { id: value1 }, data: { confirmedCharacterId: value2 } });
  }

  createReferenceCharacterFindUnique(value1: string) {
    return this.$.character.findUnique({ where: { id: value1 } });
  }

  createReferenceCharacterReferenceCreate(value1: string, value2: string, value3: string, value4: Prisma.InputJsonValue, value5: string) {
    return this.$.characterReference.create({
      data: { projectId: value1, characterId: value2, pageId: value3, bbox: value4, cropKey: value5 },
    });
  }
}
