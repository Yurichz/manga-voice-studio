import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import type { Prisma } from '@mvs/database';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class JobPublicationRepository extends TxScopeRepository {
  getPublishedPage(pageId: string) {
    return this.$.page.findUniqueOrThrow({ where: { id: pageId } });
  }

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  publishSqlQueryRaw(value1: string) {
    return this.$.$queryRaw`SELECT id FROM "Project" WHERE id=${value1} FOR UPDATE`;
  }

  publishProjectFindFirst(value1: string) {
    return this.$.project.findFirst({ where: { id: value1, deletedAt: null } });
  }

  publishJobUpdateMany(value1: string, value2: string, value3: Prisma.InputJsonValue) {
    return this.$.job.updateMany({
      where: { id: value1, attemptToken: value2, status: 'running' },
      data: { status: 'succeeded', stage: 'complete', progress: value3 },
    });
  }

  publishPageCount(value1: any) {
    return this.$.page.count({ where: { chapterId: value1 } });
  }

  publishPageCreateMany(value1: any) {
    return this.$.page.createMany({ data: value1 });
  }

  publishChapterUpdate(value1: any) {
    return this.$.chapter.update({ where: { id: value1 }, data: { revision: { increment: 1 } } });
  }

  publishPageFindFirst(value1: any, value2: string) {
    return this.$.page.findFirst({ where: { id: value1, projectId: value2 } });
  }

  publishUtteranceDeleteMany(value1: string) {
    return this.$.utterance.deleteMany({ where: { pageId: value1 } });
  }

  publishPanelDeleteMany(value1: string) {
    return this.$.panel.deleteMany({ where: { pageId: value1 } });
  }

  publishAnalysisRunDeleteMany(value1: string) {
    return this.$.analysisRun.deleteMany({ where: { pageId: value1 } });
  }

  publishCharacterAppearanceDeleteMany(value1: string) {
    return this.$.characterAppearance.deleteMany({ where: { pageId: value1 } });
  }

  publishPageUpdate(value1: string, value2: any) {
    return this.$.page.update({ where: { id: value1 }, data: { ...value2, revision: { increment: 1 } } });
  }

  publishChapterUpdate2(value1: string) {
    return this.$.chapter.update({ where: { id: value1 }, data: { revision: { increment: 1 } } });
  }

  publishAudioArtifactUpsert(
    value1: string,
    value2: any,
    value3: string,
    value4: string,
    value5: any,
    value6: any,
    value7: Prisma.InputJsonValue,
    value8: any,
    value9: any,
    value10: any,
    value11: any,
    value12: any,
    value13: any,
  ) {
    return this.$.audioArtifact.upsert({
      where: { projectId_inputHash: { projectId: value1, inputHash: value2 } },
      create: {
        projectId: value3,
        ownerId: value4,
        utteranceId: value5,
        inputHash: value6,
        snapshot: value7,
        fileKey: value8,
        sourceKey: value9,
        duration: value10,
        sampleRate: value11,
        sampleCount: value12,
        modelRevision: value13,
      },
      update: {},
    });
  }

  publishUtteranceUpdateMany(value1: any, value2: string, value3: any, value4: any, value5: any) {
    return this.$.utterance.updateMany({
      where: { id: value1, projectId: value2, revision: value3, OR: [{ activeAudioId: null }, { activeAudioId: { not: value4 } }] },
      data: { activeAudioId: value5 },
    });
  }

  publishChapterUpdate3(value1: string) {
    return this.$.chapter.update({ where: { id: value1 }, data: { revision: { increment: 1 } } });
  }

  publishVoiceProfileCreate(value1: string, value2: any) {
    return this.$.voiceProfile.create({ data: { projectId: value1, name: value2 } });
  }

  publishVoiceProfileVersionCreate(value1: string, value2: string, value3: any, value4: any, value5: any, value6: any, value7: any) {
    return this.$.voiceProfileVersion.create({
      data: {
        projectId: value1,
        profileId: value2,
        referenceKey: value3,
        transcript: value4,
        language: value5,
        checksum: value6,
        modelRevision: value7,
        settings: { rightsConfirmed: true },
      },
    });
  }

  publishAnalysisRunCreate(value1: string, value2: any, value3: any, value4: any, value5: any, value6: Prisma.InputJsonValue) {
    return this.$.analysisRun.create({
      data: { projectId: value1, pageId: value2, inputRevision: value3, modelRevision: value4, promptVersion: value5, proposal: value6 },
    });
  }

  publishCharacterAppearanceCreate(value1: any, value2: string, value3: Prisma.InputJsonValue, value4: Prisma.InputJsonValue) {
    return this.$.characterAppearance.create({ data: { pageId: value1, projectId: value2, bbox: value3, candidates: value4 } });
  }

  publishSqlExecuteRaw(value1: string, value2: any, value3: any, value4: string) {
    return this.$.$executeRaw`
UPDATE "CharacterReference"
      SET embedding=${value1}::vector,"encoderRevision"=${value2}
      WHERE id=${value3}
      AND "projectId"=${value4}
    `;
  }

  publishChapterRenderCreate(value1: string, value2: any, value3: any, value4: any, value5: Prisma.InputJsonValue) {
    return this.$.chapterRender.create({
      data: { projectId: value1, chapterId: value2, inputRevision: value3, fileKey: value4, manifest: value5 },
    });
  }

  publishJobUpdate(value1: string, value2: Prisma.InputJsonValue) {
    return this.$.job.update({ where: { id: value1 }, data: { result: value2 } });
  }
}
