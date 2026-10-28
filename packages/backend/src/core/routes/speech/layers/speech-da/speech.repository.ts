import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SpeechRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  pronunciationUtteranceFindUnique(value1: string) {
    return this.$.utterance.findUnique({ where: { id: value1 } });
  }

  selectAudioAudioArtifactFindFirst(value1: string, value2: string, value3: string) {
    return this.$.audioArtifact.findFirst({ where: { id: value1, projectId: value2, ownerId: value3 } });
  }

  selectAudioUtteranceUpdateMany(value1: string, value2: string, value3: number, value4: string) {
    return this.$.utterance.updateMany({
      where: { id: value1, projectId: value2, revision: value3 },
      data: { activeAudioId: value4, revision: { increment: 1 } },
    });
  }

  selectAudioPageUpdate(value1: string) {
    return this.$.page.update({ where: { id: value1 }, data: { revision: { increment: 1 } } });
  }

  selectAudioChapterUpdate(value1: string) {
    return this.$.chapter.update({ where: { id: value1 }, data: { revision: { increment: 1 } } });
  }

  speechChapterChapterFindUnique(value1: string) {
    return this.$.chapter.findUnique({ where: { id: value1 } });
  }

  speechChapterUtteranceFindMany(value1: string) {
    return this.$.utterance.findMany({
      where: { page: { chapterId: value1 }, included: true },
      orderBy: [{ page: { order: 'asc' } }, { order: 'asc' }],
    });
  }

  speechChapterAudioArtifactFindFirst(value1: string, value2: string) {
    return this.$.audioArtifact.findFirst({ where: { id: value1, projectId: value2 } });
  }

  cancelChapterSpeechChapterFindUnique(value1: string) {
    return this.$.chapter.findUnique({ where: { id: value1 }, include: { pages: { select: { id: true } } } });
  }

  cancelChapterSpeechJobUpdateMany(value1: string, value2: { input: { path: string[]; equals: string } }[]) {
    return this.$.job.updateMany({
      where: { projectId: value1, kind: 'speech', status: { in: ['queued', 'running', 'blocked'] }, OR: value2 },
      data: { status: 'cancel_requested' },
    });
  }

  listArtifactsAudioArtifactFindMany(value1: string, value2: string) {
    return this.$.audioArtifact.findMany({ where: { projectId: value1, ownerId: value2 }, orderBy: { createdAt: 'desc' } });
  }

  renderChapterChapterFindUnique(value1: string) {
    return this.$.chapter.findUnique({ where: { id: value1 } });
  }
}
