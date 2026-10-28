import { PrismaService } from '@mvs/backend/prisma';
import { PublicationRepository } from '@mvs/backend/repositories/publication';
import { isCurrentSpeechModel } from '@mvs/contracts';
import {
  inspectChapter,
  namespace,
  PublicationError,
  publicationFileHash,
  type PublicationMetadata,
  type Snapshot,
} from '@mvs/publication';
import { VERSION } from '@mvs/publication-format';
import { storage } from '@mvs/storage';
import { Inject, Injectable } from '@nestjs/common';
import ffmpeg from 'ffmpeg-static';
import { promises as fs } from 'node:fs';

function fail(field: string, message: string): never {
  throw new PublicationError(field, message);
}
@Injectable()
export class PublicationClService {
  constructor(
    @Inject(PublicationRepository)
    private readonly repository: PublicationRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async publicationPreview(project: any) {
    const chapters = await this.repository.publicationPreviewChapterFindMany(project.id);
    const ids = chapters.flatMap((c: any) => ((c.renders[0]?.manifest as any)?.segments || []).map((s: any) => s.audioArtifactId)),
      artifacts = new Map((await this.repository.publicationPreviewAudioArtifactFindMany(project.id, ids)).map((a: any) => [a.id, a]));
    const exe = process.env.FFMPEG_PATH || (ffmpeg as unknown as string | null),
      ffmpegReady = exe
        ? await fs
          .access(exe)
          .then(() => true)
          .catch(() => false)
        : false;
    const reports = [];

    for (const c of chapters) {
      const report = inspectChapter(c);

      if (!ffmpegReady) {
        report.issues.push({ field: 'ffmpeg', message: 'FFmpeg is unavailable. Install ffmpeg-static or set FFMPEG_PATH' });
      }

      for (const p of c.pages) {
        try {
          if (!(await fs.stat(storage.resolve(p.imageKey))).size) {
            throw new Error();
          }
        } catch {
          report.issues.push({ field: 'image', pageId: p.id, message: 'The page image is not ready' });
        }

        for (const u of p.utterances.filter((u: any) => u.included)) {
          const s = ((c.renders[0]?.manifest as any)?.segments || []).find((s: any) => s.utteranceId === u.id),
            input = ((artifacts.get(s?.audioArtifactId) as any)?.snapshot as any)?.canonical;

          if (
            !input ||
            !isCurrentSpeechModel(input) ||
            input.spokenText !== u.spokenText ||
            input.voiceVersionId !== u.voiceVersionId ||
            input.referenceChecksum !== u.voice?.checksum ||
            input.language !== project.speechLanguage
          ) {
            report.issues.push({ field: 'audio', utteranceId: u.id, pageId: p.id, message: 'The audio is missing or stale' });
          }
        }
      }

      if (c.renders[0]) {
        try {
          if (!(await fs.stat(storage.resolve(c.renders[0].fileKey))).size) {
            throw new Error();
          }
        } catch {
          report.issues.push({ field: 'render', message: 'The rendered audio file is unavailable; render the chapter again' });
        }
      }

      report.ready = report.issues.length === 0;
      reports.push(report);
    }

    return { chapters: reports, formatVersion: VERSION };
  }

  async capturePublication(ownerId: string, projectId: string, chapterIds: string[], metadata: PublicationMetadata): Promise<Snapshot> {
    return this.prisma.$txe(
      async (tx: any) => {
        const p = await this.repository.tx(tx).capturePublicationProjectFindFirst(projectId, ownerId);

        if (!p) {
          fail('project', 'The project is unavailable');
        }

        const sourceNamespace = await namespace(projectId);
        const chapters = await this.repository.tx(tx).capturePublicationChapterFindMany(projectId, chapterIds);

        if (chapters.length !== chapterIds.length) {
          fail('chapters', 'Some chapters do not belong to this project');
        }

        for (const c of chapters) {
          const report = inspectChapter(c);

          if (report.issues.length) {
            fail(report.issues[0].utteranceId || c.id, report.issues[0].message);
          }

          for (const s of (c.renders[0].manifest as any).segments) {
            const u = c.pages.flatMap((p: any) => p.utterances).find((u: any) => u.id === s.utteranceId),
              a = await this.repository.tx(tx).capturePublicationAudioArtifactFindFirst(s.audioArtifactId, projectId),
              input = (a?.snapshot as any)?.canonical;

            if (
              !u ||
              !input ||
              !isCurrentSpeechModel(input) ||
              input.spokenText !== u.spokenText ||
              input.voiceVersionId !== u.voiceVersionId ||
              input.referenceChecksum !== u.voice?.checksum ||
              input.language !== p.speechLanguage
            ) {
              fail(s.utteranceId, 'The audio is missing or stale');
            }
          }
        }

        const checksums = new Map<string, string>();

        for (const c of chapters) {
          for (const page of c.pages) {
            checksums.set(page.id, await publicationFileHash(storage.resolve(page.imageKey)));
          }
        }

        if (metadata.coverPageId && !chapters.some((c: any) => c.pages.some((p: any) => p.id === metadata.coverPageId))) {
          fail('cover', 'The cover must be one of the selected pages');
        }

        return {
          sourceNamespace,
          project: {
            id: p.id,
            revision: p.revision,
            title: p.title,
            textLanguage: p.textLanguage,
            speechLanguage: p.speechLanguage,
            readingDirection: p.readingDirection as 'rtl' | 'ltr',
          },
          metadata,
          chapters: chapters.map((c: any) => ({
            id: c.id,
            title: c.title,
            order: c.order,
            revision: c.revision,
            readingDirection: c.readingDirection || p.readingDirection,
            render: { fileKey: c.renders[0].fileKey, manifest: c.renders[0].manifest },
            pages: c.pages.map((page: any) => ({
              id: page.id,
              order: page.order,
              width: page.width,
              height: page.height,
              imageKey: page.imageKey,
              checksum: checksums.get(page.id),
              panels: page.panels.map((v: any) => ({ id: v.id, order: v.order, bbox: v.bbox })),
              utterances: page.utterances.map((u: any) => ({
                id: u.id,
                order: u.order,
                panelId: u.panelId,
                bbox: u.bbox,
                speakerId: u.characterId,
                originalText: u.originalText,
                spokenText: u.spokenText,
                kind: u.kind,
                included: u.included,
                speaker: u.character ? { id: u.character.id, name: u.character.name } : null,
              })),
            })),
          })),
        };
      },
      undefined,
      { isolationLevel: 'RepeatableRead', timeout: 30000 },
    );
  }
}
