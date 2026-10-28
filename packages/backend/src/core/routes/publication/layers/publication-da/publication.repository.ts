import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class PublicationRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  publicationPreviewChapterFindMany(value1: any) {
    return this.$.chapter.findMany({
      where: { projectId: value1 },
      orderBy: { order: 'asc' },
      include: {
        pages: { orderBy: { order: 'asc' }, include: { utterances: { orderBy: { order: 'asc' }, include: { voice: true } } } },
        renders: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  publicationPreviewAudioArtifactFindMany(value1: any, value2: any[]) {
    return this.$.audioArtifact.findMany({ where: { projectId: value1, id: { in: value2 } } });
  }

  capturePublicationProjectFindFirst(value1: string, value2: string) {
    return this.$.project.findFirst({ where: { id: value1, ownerId: value2, deletedAt: null } });
  }

  capturePublicationChapterFindMany(value1: string, value2: string[]) {
    return this.$.chapter.findMany({
      where: { projectId: value1, id: { in: value2 } },
      orderBy: { order: 'asc' },
      include: {
        pages: {
          orderBy: { order: 'asc' },
          include: {
            panels: { orderBy: { order: 'asc' } },
            utterances: { orderBy: { order: 'asc' }, include: { character: true, voice: true } },
          },
        },
        renders: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  capturePublicationAudioArtifactFindFirst(value1: any, value2: string) {
    return this.$.audioArtifact.findFirst({ where: { id: value1, projectId: value2 } });
  }
}
