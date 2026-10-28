import { PrismaService } from '@mvs/backend/prisma';
import { RenderSnapshotRepository } from '@mvs/backend/repositories/render-snapshot';
import { baseSpeechInput, speechInput } from '@mvs/contracts';
import { inputHash, prepareSpeechTexts } from '@mvs/contracts/server';
import { Inject, Injectable } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

@Injectable()
export class RenderSnapshotClService {
  constructor(
    @Inject(RenderSnapshotRepository)
    private readonly repository: RenderSnapshotRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async snapshotRender(j: any) {
    // Prepare outside the DB transaction, then verify the same chapter/language snapshot.
    const before = await this.repository.snapshotRenderChapterFindUnique(j.input.chapterId);

    if (!before || before.projectId !== j.projectId || before.revision !== j.input.inputRevision) {
      throw new UnrecoverableError('Глава изменилась до начала сборки');
    }

    const utterances = before.pages.flatMap((p) => p.utterances),
      prepared = await prepareSpeechTexts(
        utterances.map((u) => u.spokenText),
        before.project.speechLanguage,
      );
    const texts = new Map(utterances.map((u, i) => [u.id, { source: u.spokenText, value: prepared[i] }]));

    return this.prisma.$txe(
      async (tx) => {
        const c = await this.repository.tx(tx).snapshotRenderChapterFindUnique2(j.input.chapterId);

        if (!c || c.projectId !== j.projectId || c.revision !== j.input.inputRevision) {
          throw new UnrecoverableError('Глава изменилась до начала сборки');
        }

        const p = await this.repository.tx(tx).snapshotRenderProjectFindUniqueOrThrow(j.projectId);

        if (p.speechLanguage !== before.project.speechLanguage) {
          throw new UnrecoverableError('Язык речи изменился');
        }

        const segments = [];

        for (const page of c.pages) {
          for (const utterance of page.utterances.filter((u) => u.included)) {
            if (utterance.reviewStatus !== 'reviewed' || !utterance.voiceVersionId) {
              throw new UnrecoverableError('Все включённые реплики должны быть проверены и иметь голос');
            }

            const text = texts.get(utterance.id);

            if (!text || text.source !== utterance.spokenText) {
              throw new UnrecoverableError('Текст реплики изменился');
            }

            const voice = await this.repository.tx(tx).snapshotRenderVoiceProfileVersionFindFirstOrThrow(utterance.voiceVersionId, p.id);
            const canonical = speechInput(j.ownerId, p.id, utterance, voice, p.speechLanguage, text.value);
            const hash = inputHash(canonical);
            const artifact = utterance.activeAudioId
              ? await this.repository.tx(tx).snapshotRenderAudioArtifactFindFirst(utterance.activeAudioId, p.id)
              : await this.repository.tx(tx).snapshotRenderAudioArtifactFindUnique(p.id, hash);

            if (!artifact) {
              throw new UnrecoverableError('Не всё актуальное аудио готово');
            }

            const actual = (artifact.snapshot as any).canonical;
            const base = baseSpeechInput(actual);

            if (inputHash(base) !== hash) {
              throw new UnrecoverableError('Аудио устарело');
            }

            const character = utterance.characterId
              ? await this.repository.tx(tx).snapshotRenderCharacterFindUnique(utterance.characterId)
              : null;

            segments.push({
              utteranceId: utterance.id,
              pageId: page.id,
              panelId: utterance.panelId,
              bbox: utterance.bbox,
              text: utterance.spokenText,
              character: character ? { id: character.id, name: character.name } : null,
              audioArtifactId: artifact.id,
              fileKey: artifact.fileKey,
              pauseMs: utterance.pauseMs,
            });
          }
        }

        return { projectId: p.id, chapterId: c.id, inputRevision: c.revision, segments };
      },
      undefined,
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
