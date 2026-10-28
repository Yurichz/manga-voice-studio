import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class RenderSnapshotRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  snapshotRenderChapterFindUnique(value1: any) {
    return this.$.chapter.findUnique({
      where: { id: value1 },
      include: { project: true, pages: { include: { utterances: { where: { included: true } } } } },
    });
  }

  snapshotRenderChapterFindUnique2(value1: any) {
    return this.$.chapter.findUnique({
      where: { id: value1 },
      include: { pages: { orderBy: { order: 'asc' }, include: { utterances: { orderBy: { order: 'asc' } } } } },
    });
  }

  snapshotRenderProjectFindUniqueOrThrow(value1: any) {
    return this.$.project.findUniqueOrThrow({ where: { id: value1 } });
  }

  snapshotRenderVoiceProfileVersionFindFirstOrThrow(value1: string, value2: string) {
    return this.$.voiceProfileVersion.findFirstOrThrow({ where: { id: value1, projectId: value2 } });
  }

  snapshotRenderAudioArtifactFindFirst(value1: string, value2: string) {
    return this.$.audioArtifact.findFirst({ where: { id: value1, projectId: value2 } });
  }

  snapshotRenderAudioArtifactFindUnique(value1: string, value2: string) {
    return this.$.audioArtifact.findUnique({ where: { projectId_inputHash: { projectId: value1, inputHash: value2 } } });
  }

  snapshotRenderCharacterFindUnique(value1: string) {
    return this.$.character.findUnique({ where: { id: value1 } });
  }
}
