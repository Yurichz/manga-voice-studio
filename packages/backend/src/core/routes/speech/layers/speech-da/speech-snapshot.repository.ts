import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SpeechSnapshotRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  speechSnapshotUtteranceFindUnique(value1: string) {
    return this.$.utterance.findUnique({ where: { id: value1 }, include: { page: true } });
  }

  speechSnapshotVoiceProfileVersionFindFirst(value1: string, value2: string) {
    return this.$.voiceProfileVersion.findFirst({ where: { id: value1, projectId: value2 } });
  }
}
