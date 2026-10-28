import { AccessService } from '@mvs/backend/access';
import { ApiError, idempotencySchema } from '@mvs/backend/common';
import { JobEnqueueClService } from '@mvs/backend/jobs';
import { SpeechRepository } from '@mvs/backend/repositories/speech';
import { SpeechSnapshotClService } from '@mvs/backend/speech';
import { baseSpeechInput } from '@mvs/contracts';
import { inputHash, prepareSpeechTexts } from '@mvs/contracts/server';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { type SelectAudioDto, type SpeechChapterDto, type SpeechUtteranceDto } from '../../dto/speech.dto.js';
import { SpeechClService } from '../speech-cl/speech-cl.service.js';

@Injectable()
export class SpeechService {
  constructor(
    @Inject(SpeechClService)
    private readonly coordinator: SpeechClService,
    @Inject(SpeechRepository)
    private readonly repository: SpeechRepository,
    @Inject(AccessService)
    private readonly access: AccessService,
    @Inject(JobEnqueueClService)
    private readonly jobs: JobEnqueueClService,
    @Inject(SpeechSnapshotClService)
    private readonly speech: SpeechSnapshotClService,
  ) {}

  async pronunciation(ownerId: string, utteranceId: string) {
    const u = await this.repository.pronunciationUtteranceFindUnique(utteranceId);

    if (!u) {
      throw new ApiError(404, 'Реплика не найдена');
    }

    const p = await this.access.project(ownerId, u.projectId);
    const [prepared] = await prepareSpeechTexts([u.spokenText], p.speechLanguage);

    return { ...prepared, utteranceId: u.id, utteranceRevision: u.revision, spokenText: u.spokenText };
  }

  async speechUtterance(ownerId: string, utteranceId: string, input: SpeechUtteranceDto, idempotencyKey: string | undefined) {
    const v = input;
    const key = idempotencySchema.parse(idempotencyKey);
    const s = await this.speech.speechSnapshot(ownerId, utteranceId, v.allowUnreviewed, v.variation ? key : undefined);
    const j = await this.jobs.job(ownerId, s.projectId, 'speech', { ...s, preview: true }, key);

    return { jobId: j.id };
  }

  async selectAudio(ownerId: string, utteranceId: string, input: SelectAudioDto) {
    return this.coordinator.selectAudio(ownerId, utteranceId, input);
  }

  async speechChapter(ownerId: string, chapterId: string, input: SpeechChapterDto, idempotencyKey: string | undefined) {
    const c = await this.repository.speechChapterChapterFindUnique(chapterId);

    if (!c) {
      throw new ApiError(404, 'Глава не найдена');
    }

    await this.access.project(ownerId, c.projectId);
    const v = input;
    const key = idempotencySchema.parse(idempotencyKey);
    const utterances = await this.repository.speechChapterUtteranceFindMany(c.id);
    const snapshots = [];

    for (const u of utterances) {
      const snapshot = await this.speech.speechSnapshot(ownerId, u.id, v.allowUnreviewed);

      if (u.activeAudioId) {
        const artifact = await this.repository.speechChapterAudioArtifactFindFirst(u.activeAudioId, c.projectId);

        if (artifact) {
          const base = baseSpeechInput((artifact.snapshot as any).canonical);

          if (inputHash(base) === inputHash(snapshot.canonical)) {
            continue;
          }
        }
      }

      snapshots.push(snapshot);
    }

    const batchId = randomUUID(),
      remaining = Math.max(0, snapshots.length - 100);
    const jobs = await this.jobs.enqueue(
      ownerId,
      c.projectId,
      'speech',
      snapshots.slice(0, 100).map((s) => ({ input: { ...s, batchRemaining: remaining }, key: key + ':' + s.utteranceId })),
      batchId,
    );

    return { jobIds: jobs.map((j) => j.id), batchId: jobs[0]?.batchId || batchId, remaining };
  }

  async cancelChapterSpeech(ownerId: string, chapterId: string) {
    const c = await this.repository.cancelChapterSpeechChapterFindUnique(chapterId);

    if (!c) {
      throw new ApiError(404, 'Глава не найдена');
    }

    await this.access.project(ownerId, c.projectId);
    const cancelled = await this.repository.cancelChapterSpeechJobUpdateMany(
      c.projectId,
      c.pages.map((p) => ({ input: { path: ['pageId'], equals: p.id } })),
    );

    return { cancelRequested: cancelled.count };
  }

  async listArtifacts(ownerId: string, projectId: string) {
    const p = await this.access.project(ownerId, projectId);

    return await this.repository.listArtifactsAudioArtifactFindMany(p.id, p.ownerId);
  }

  async renderChapter(ownerId: string, chapterId: string, idempotencyKey: string | undefined) {
    const c = await this.repository.renderChapterChapterFindUnique(chapterId);

    if (!c) {
      throw new ApiError(404, 'Глава не найдена');
    }

    await this.access.project(ownerId, c.projectId);
    const j = await this.jobs.job(
      ownerId,
      c.projectId,
      'render',
      { chapterId: c.id, inputRevision: c.revision },
      idempotencySchema.parse(idempotencyKey),
    );

    return { jobId: j.id };
  }
}
