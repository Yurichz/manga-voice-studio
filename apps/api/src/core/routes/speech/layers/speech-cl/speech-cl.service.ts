import { ApiError } from '@mvs/backend/common';
import { PrismaService } from '@mvs/backend/prisma';
import { SpeechRepository } from '@mvs/backend/repositories/speech';
import { SpeechSnapshotClService } from '@mvs/backend/speech';
import { baseSpeechInput } from '@mvs/contracts';
import { inputHash } from '@mvs/contracts/server';
import { Inject, Injectable } from '@nestjs/common';
import { type SelectAudioDto } from '../../dto/speech.dto.js';

@Injectable()
export class SpeechClService {
  constructor(
    @Inject(SpeechRepository)
    private readonly repository: SpeechRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SpeechSnapshotClService)
    private readonly speech: SpeechSnapshotClService,
  ) {}

  async selectAudio(ownerId: string, utteranceId: string, input: SelectAudioDto) {
    const v = input;
    const s = await this.speech.speechSnapshot(ownerId, utteranceId, false);
    const artifact = await this.repository.selectAudioAudioArtifactFindFirst(v.artifactId, s.projectId, ownerId);

    if (!artifact) {
      throw new ApiError(404, 'Дубль не найден');
    }

    const canonical = baseSpeechInput((artifact.snapshot as any).canonical);

    if (inputHash(canonical) !== inputHash(s.canonical)) {
      throw new ApiError(422, 'Дубль не соответствует текущему тексту и голосу');
    }

    await this.prisma.$txe(async (tx) => {
      const n = await this.repository.tx(tx).selectAudioUtteranceUpdateMany(s.utteranceId, s.projectId, v.expectedRevision, artifact.id);

      if (!n.count || s.utteranceRevision !== v.expectedRevision) {
        throw new ApiError(409, 'Реплика изменилась');
      }

      const p = await this.repository.tx(tx).selectAudioPageUpdate(s.pageId);

      await this.repository.tx(tx).selectAudioChapterUpdate(p.chapterId);
    });

    return { activeAudioId: artifact.id, revision: v.expectedRevision + 1 };
  }
}
