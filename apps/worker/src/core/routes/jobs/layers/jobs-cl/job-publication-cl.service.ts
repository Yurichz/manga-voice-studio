import { json } from '@mvs/backend/common';
import { PrismaService } from '@mvs/backend/prisma';
import { JobPublicationRepository } from '@mvs/backend/repositories/job-publication';
import { isCurrentSpeechModel } from '@mvs/contracts';
import { limits } from '@mvs/storage/import';
import { Inject, Injectable } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import type { StoredJob } from '../../interfaces/job-context.js';

@Injectable()
export class JobPublicationClService {
  constructor(
    @Inject(JobPublicationRepository)
    private readonly repository: JobPublicationRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async publish(j: StoredJob, v: any, result: any, extra: any, token: string, seen: Set<string>) {
    const jobId = j.id;

    await this.prisma.$txe(async (tx) => {
      await this.repository.tx(tx).publishSqlQueryRaw(j.projectId);
      const valid = await this.repository.tx(tx).publishProjectFindFirst(j.projectId);
      const fence = await this.repository
        .tx(tx)
        .publishJobUpdateMany(
          jobId,
          token,
          json({ phase: 'complete', completedPhases: [...seen, 'publishing'], updatedAt: new Date().toISOString() }),
        );

      if (!valid || !fence.count) {
        throw new UnrecoverableError('Result rejected by cancellation/fencing');
      }

      if (j.kind === 'import') {
        const existing = await this.repository.tx(tx).publishPageCount(v.chapterId);

        if (existing + extra.length > limits.pages) {
          throw new UnrecoverableError('A maximum of 50 pages is allowed');
        }

        await this.repository.tx(tx).publishPageCreateMany(extra.map((p: any, i: number) => ({ ...p, order: existing + i })));
        await this.repository.tx(tx).publishChapterUpdate(v.chapterId);
      }

      if (j.kind === 'replace_page') {
        const page = await this.repository.tx(tx).publishPageFindFirst(v.pageId, j.projectId);

        if (!page || page.revision !== v.inputRevision) {
          throw new UnrecoverableError('The page changed');
        }

        await this.repository.tx(tx).publishUtteranceDeleteMany(page.id);
        await this.repository.tx(tx).publishPanelDeleteMany(page.id);
        await this.repository.tx(tx).publishAnalysisRunDeleteMany(page.id);
        await this.repository.tx(tx).publishCharacterAppearanceDeleteMany(page.id);
        await this.repository.tx(tx).publishPageUpdate(page.id, extra);
        await this.repository.tx(tx).publishChapterUpdate2(page.chapterId);
      }

      if (j.kind === 'speech' && extra) {
        const a = await this.repository
          .tx(tx)
          .publishAudioArtifactUpsert(
            j.projectId,
            result.inputHash,
            j.projectId,
            j.ownerId,
            v.utteranceId,
            result.inputHash,
            json(v),
            result.fileKey,
            result.sourceKey,
            result.duration,
            result.sampleRate,
            result.sampleCount,
            result.modelRevision,
          );

        result.artifactId = a.id;
      }

      if (j.kind === 'speech' && isCurrentSpeechModel(v.canonical)) {
        const updated = await this.repository
          .tx(tx)
          .publishUtteranceUpdateMany(v.utteranceId, j.projectId, v.utteranceRevision, result.artifactId, result.artifactId);

        if (updated.count) {
          await this.repository.tx(tx).publishChapterUpdate3((await this.repository.tx(tx).getPublishedPage(v.pageId)).chapterId);
        }
      }

      if (j.kind === 'voice_import') {
        const profile = await this.repository.tx(tx).publishVoiceProfileCreate(j.projectId, v.name);

        result.voiceVersion = await this.repository
          .tx(tx)
          .publishVoiceProfileVersionCreate(
            j.projectId,
            profile.id,
            result.fileKey,
            v.transcript,
            v.language,
            result.checksum,
            result.modelRevision,
          );
      }

      if (j.kind === 'analysis') {
        const a = await this.repository
          .tx(tx)
          .publishAnalysisRunCreate(
            j.projectId,
            v.pageId,
            v.inputRevision,
            result.modelRevision,
            result.promptVersion,
            json(result.proposal),
          );

        result.analysisId = a.id;
      }

      if (j.kind === 'candidates') {
        const appearance = await this.repository
          .tx(tx)
          .publishCharacterAppearanceCreate(v.pageId, j.projectId, json(v.bbox), json(result.candidates));

        result.appearanceId = appearance.id;
      }

      if (j.kind === 'embedding') {
        const vector = '[' + result.embedding.join(',') + ']';

        await this.repository.tx(tx).publishSqlExecuteRaw(vector, result.encoderRevision, v.referenceId, j.projectId);
        delete result.embedding;
      }

      if (j.kind === 'render') {
        const render = await this.repository
          .tx(tx)
          .publishChapterRenderCreate(
            j.projectId,
            v.chapterId,
            v.inputRevision,
            result.fileKey,
            json({ ...result.manifest, zipKey: result.zipKey }),
          );

        result.renderId = render.id;
      }

      await this.repository.tx(tx).publishJobUpdate(jobId, json(result));
    });
  }
}
