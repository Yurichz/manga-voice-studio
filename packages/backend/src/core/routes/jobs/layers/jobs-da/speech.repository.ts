import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SpeechSynthesisRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  handleAudioArtifactFindUnique(value1: string, value2: string) {
    return this.$.audioArtifact.findUnique({ where: { projectId_inputHash: { projectId: value1, inputHash: value2 } } });
  }
}
