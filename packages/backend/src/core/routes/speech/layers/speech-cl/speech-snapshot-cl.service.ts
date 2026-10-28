import { AccessService } from '@mvs/backend/access';
import { ApiError } from '@mvs/backend/common';
import { SpeechSnapshotRepository } from '@mvs/backend/repositories/speech-snapshot';
import { speechInput } from '@mvs/contracts';
import { prepareSpeechTexts } from '@mvs/contracts/server';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SpeechSnapshotClService {
  constructor(
    @Inject(SpeechSnapshotRepository)
    private readonly repository: SpeechSnapshotRepository,
    @Inject(AccessService)
    private readonly access: AccessService,
  ) {}

  async speechSnapshot(ownerId: string, utteranceId: string, allowUnreviewed: boolean, nonce?: string) {
    const u = await this.repository.speechSnapshotUtteranceFindUnique(utteranceId);

    if (!u) {
      throw new ApiError(404, 'Реплика не найдена');
    }

    const p = await this.access.project(ownerId, u.projectId);

    if (!u.included || !u.spokenText.trim() || !u.voiceVersionId) {
      throw new ApiError(422, 'Реплика требует текста и явно выбранного голоса');
    }

    if (u.reviewStatus !== 'reviewed' && !allowUnreviewed) {
      throw new ApiError(422, 'Сначала проверьте реплику');
    }

    const voice = await this.repository.speechSnapshotVoiceProfileVersionFindFirst(u.voiceVersionId, u.projectId);

    if (!voice) {
      throw new ApiError(422, 'Голос недоступен');
    }

    const [prepared] = await prepareSpeechTexts([u.spokenText], p.speechLanguage);

    return {
      projectId: p.id,
      utteranceId: u.id,
      pageId: u.pageId,
      utteranceRevision: u.revision,
      canonical: speechInput(ownerId, p.id, u, voice, p.speechLanguage, prepared, nonce),
      referenceKey: voice.referenceKey,
      referenceText: voice.transcript,
    };
  }
}
