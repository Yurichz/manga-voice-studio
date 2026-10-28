import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import type { Prisma } from '@mvs/database';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class VoicesRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  applyVoiceVoiceProfileVersionFindUnique(value1: string) {
    return this.$.voiceProfileVersion.findUnique({ where: { id: value1 } });
  }

  applyVoiceUtteranceUpdateMany(value1: string, value2: string, value3: number, value4: string) {
    return this.$.utterance.updateMany({
      where: { id: value1, projectId: value2, revision: value3 },
      data: { voiceVersionId: value4, activeAudioId: null, revision: { increment: 1 } },
    });
  }

  applyVoicePageUpdateMany(value1: string, value2: string[]) {
    return this.$.page.updateMany({
      where: { projectId: value1, utterances: { some: { id: { in: value2 } } } },
      data: { revision: { increment: 1 } },
    });
  }

  applyVoiceChapterUpdateMany(value1: string) {
    return this.$.chapter.updateMany({ where: { projectId: value1 }, data: { revision: { increment: 1 } } });
  }

  saveVoiceJobFindUnique(value1: string) {
    return this.$.job.findUnique({ where: { id: value1 } });
  }

  saveVoiceVoiceProfileFindFirst(value1: string, value2: string) {
    return this.$.voiceProfile.findFirst({ where: { id: value1, projectId: value2 } });
  }

  saveVoiceVoiceProfileCreate(value1: string, value2: any) {
    return this.$.voiceProfile.create({ data: { projectId: value1, name: value2 } });
  }

  saveVoiceVoiceProfileVersionCreate(
    value1: string,
    value2: string,
    value3: any,
    value4: any,
    value5: any,
    value6: any,
    value7: any,
    value8: Prisma.InputJsonValue,
  ) {
    return this.$.voiceProfileVersion.create({
      data: {
        projectId: value1,
        profileId: value2,
        referenceKey: value3,
        transcript: value4,
        language: value5,
        checksum: value6,
        modelRevision: value7,
        settings: value8,
      },
    });
  }
}
