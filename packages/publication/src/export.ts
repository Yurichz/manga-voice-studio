import { bboxSchema } from '@mvs/contracts';
import {
  canonical,
  chapterDigest,
  manifestDigest,
  validateChapter,
  validateManifest,
  VERSION,
  type Chapter,
  type Manifest,
} from '@mvs/publication-format';
import { storage } from '@mvs/storage';
import archiver from 'archiver';
import ffmpeg from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export type PublicationMetadata = { description: string; credits: { role: string; name: string }[]; coverPageId: string | null };
export type Snapshot = {
  sourceNamespace: string;
  project: { id: string; revision: number; title: string; textLanguage: string; speechLanguage: string; readingDirection: 'rtl' | 'ltr' };
  metadata: PublicationMetadata;
  chapters: any[];
};
const encoderVersion = 'mp3-lame-128k-mono24k-xing-v1';

export class PublicationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
  }
}
const fail = (field: string, message: string): never => {
  throw new PublicationError(field, message);
};

export async function namespace(projectId: string) {
  const key = projectId + '/publication/namespace.json',
    file = storage.resolve(key);

  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.' + randomUUID() + '.tmp';

  try {
    await fs.writeFile(temp, JSON.stringify({ sourceNamespace: randomUUID() }), { flag: 'wx' });
    try {
      await fs.link(temp, file);
    } catch (e: any) {
      if (e.code !== 'EEXIST') {
        throw e;
      }
    }
  } finally {
    await fs.rm(temp, { force: true });
  }

  return JSON.parse(await fs.readFile(file, 'utf8')).sourceNamespace as string;
}
export function inspectChapter(c: any) {
  const issues: { field: string; message: string; utteranceId?: string; pageId?: string }[] = [],
    render = c.renders[0];
  const issue = (field: string, message: string, u?: any) =>
    issues.push({ field, message, ...(u ? { utteranceId: u.id, pageId: u.pageId } : {}) });

  if (!c.pages.length) {
    issue('pages', 'The chapter contains no pages');
  }

  if (!render || render.inputRevision !== c.revision) {
    issue('render', 'Render the current chapter first');
  }

  const segments = render?.manifest?.segments || [];

  for (const p of c.pages) {
    for (const u of p.utterances) {
      if (!bboxSchema.safeParse(u.bbox).success) {
        issue('bbox', 'Invalid region', u);
      }

      if (u.included) {
        if (u.reviewStatus !== 'reviewed') {
          issue('reviewStatus', 'The utterance has not been reviewed', u);
        }

        const s = segments.find((s: any) => s.utteranceId === u.id);

        if (
          !s ||
          s.pageId !== p.id ||
          s.text !== u.spokenText ||
          s.panelId !== u.panelId ||
          canonical(s.bbox) !== canonical(u.bbox) ||
          (u.activeAudioId && s.audioArtifactId !== u.activeAudioId)
        ) {
          issue('audio', 'The render has no current audio for this utterance', u);
        }

        if (!u.voiceVersionId) {
          issue('voice', 'No voice is pinned', u);
        }
      }
    }
  }

  return {
    chapterId: c.id,
    title: c.title,
    pages: c.pages.length,
    utterances: c.pages.flatMap((p: any) => p.utterances).length,
    durationMs: render?.manifest?.durationMs || 0,
    estimatedBytes:
      Math.ceil((render?.manifest?.durationMs || 0) * 16) + c.pages.reduce((n: number, p: any) => n + p.width * p.height * 0.25, 0),
    issues,
    ready: issues.length === 0,
  };
}
function encode(exe: string, args: string[], signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true, signal, timeout: 120000 });

    child.stdout.resume();
    child.stderr.resume();
    child.on('error', () => reject(new Error('FFmpeg is unavailable. Install ffmpeg-static or set FFMPEG_PATH')));
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error('FFmpeg could not encode the MP3'))));
  });
}
export async function publicationFileHash(file: string) {
  const hash = createHash('sha256');

  for await (const b of createReadStream(file)) {
    hash.update(b);
  }

  return hash.digest('hex');
}
export async function exportPublication(
  snapshot: Snapshot,
  output: string,
  signal?: AbortSignal,
  progress: (phase: string, completed?: number, total?: number) => Promise<void> = async () => {},
) {
  const exe = process.env.FFMPEG_PATH || (ffmpeg as unknown as string | null);

  if (!exe) {
    throw new Error('FFmpeg is missing: publication export requires MP3 encoding');
  }

  const stage = output + '.' + randomUUID() + '.stage';

  await fs.mkdir(stage, { recursive: true });
  const files: Manifest['files'] = [],
    assets = new Map<string, string>();

  async function asset(source: string, kind: 'images' | 'audio', ext: string, mime: any) {
    signal?.throwIfAborted();
    const hash = await publicationFileHash(source),
      name = `assets/${kind}/${hash}.${ext}`;

    if (!assets.has(name)) {
      assets.set(name, source);
      files.push({ path: name, size: (await fs.stat(source)).size, mime, sha256: hash });
    }

    return name;
  }
  try {
    const chapterList: Manifest['chapters'] = [];
    let cover: string | null = null;

    for (const [index, c] of snapshot.chapters.entries()) {
      signal?.throwIfAborted();
      await progress('web_encoding', index, snapshot.chapters.length);
      const source = storage.resolve(c.render.fileKey),
        wavHash = await publicationFileHash(source),
        cacheKey =
          snapshot.project.id +
          '/publication/cache/' +
          createHash('sha256')
            .update(wavHash + encoderVersion)
            .digest('hex') +
          '.mp3',
        mp3 = storage.resolve(cacheKey);

      await fs.mkdir(path.dirname(mp3), { recursive: true });
      try {
        await fs.access(mp3);
      } catch {
        const tmp = mp3 + '.' + randomUUID() + '.tmp';

        try {
          await encode(
            exe,
            [
              '-v',
              'error',
              '-nostdin',
              '-protocol_whitelist',
              'file',
              '-threads',
              '1',
              '-i',
              source,
              '-map',
              '0:a:0',
              '-map_metadata',
              '-1',
              '-c:a',
              'libmp3lame',
              '-b:a',
              '128k',
              '-ar',
              '24000',
              '-ac',
              '1',
              '-write_xing',
              '1',
              '-f',
              'mp3',
              '-y',
              tmp,
            ],
            signal,
          );
          await fs.rename(tmp, mp3);
        } finally {
          await fs.rm(tmp, { force: true });
        }
      }

      const decoded = path.join(stage, index + '.pcm');

      await encode(
        exe,
        [
          '-v',
          'error',
          '-nostdin',
          '-protocol_whitelist',
          'file',
          '-threads',
          '1',
          '-i',
          mp3,
          '-f',
          's16le',
          '-ar',
          '24000',
          '-ac',
          '1',
          '-y',
          decoded,
        ],
        signal,
      );
      const durationMs = (await fs.stat(decoded)).size / 48;

      await fs.rm(decoded);
      if (Math.abs(durationMs - c.render.manifest.durationMs) > 2) {
        fail(c.id, 'The gapless-decoded MP3 duration does not match the WAV');
      }

      const audio = await asset(mp3, 'audio', 'mp3', 'audio/mpeg'),
        pages = [];

      for (const p of c.pages) {
        const input = storage.resolve(p.imageKey),
          checksum = await publicationFileHash(input);

        if (p.checksum && checksum !== p.checksum) {
          fail(p.id, 'The page file changed after the snapshot');
        }

        const imageFile = storage.resolve(snapshot.project.id + '/publication/cache/' + checksum + '-webp90-v1.webp');

        await fs.mkdir(path.dirname(imageFile), { recursive: true });
        try {
          await fs.access(imageFile);
        } catch {
          const tmp = imageFile + '.' + randomUUID() + '.tmp';

          try {
            await sharp(input, { limitInputPixels: 40_000_000 }).webp({ quality: 90 }).toFile(tmp);
            await fs.rename(tmp, imageFile);
          } finally {
            await fs.rm(tmp, { force: true });
          }
        }

        const image = await asset(imageFile, 'images', 'webp', 'image/webp');

        if (p.id === snapshot.metadata.coverPageId) {
          cover = image;
        }

        pages.push({
          id: p.id,
          order: p.order,
          width: p.width,
          height: p.height,
          image,
          panels: p.panels,
          utterances: p.utterances.map(({ speaker: _s, ...u }: any) => u),
        });
      }

      const speakers = [
        ...new Map(
          c.pages
            .flatMap((p: any) => p.utterances)
            .filter((u: any) => u.speaker)
            .map((u: any) => [u.speaker.id, u.speaker]),
        ).values(),
      ] as Chapter['speakers'];
      const body = {
        sourceChapterId: c.id,
        title: c.title,
        order: c.order,
        textLanguage: snapshot.project.textLanguage,
        speechLanguage: snapshot.project.speechLanguage,
        readingDirection: c.readingDirection,
        pages,
        speakers,
        track: {
          trackId: c.id + '-main',
          language: snapshot.project.speechLanguage,
          asset: audio,
          mediaType: 'audio/mpeg' as const,
          durationMs,
          timeBase: 'delivered-audio-ms' as const,
        },
        cues: c.render.manifest.segments.map((s: any) => ({
          utteranceId: s.utteranceId,
          pageId: s.pageId,
          panelId: s.panelId ?? null,
          bbox: s.bbox ?? null,
          speakerId: s.character?.id ?? null,
          startMs: s.startSample / 24,
          endMs: s.endSample / 24,
        })),
      };
      const digest = chapterDigest(body),
        chapter = validateChapter({ ...body, snapshotId: digest, contentDigest: digest }),
        relative = `chapters/${c.id}/chapter.json`,
        file = path.join(stage, c.id + '.json');

      await fs.writeFile(file, canonical(chapter));
      assets.set(relative, file);
      files.push({ path: relative, size: (await fs.stat(file)).size, mime: 'application/json', sha256: await publicationFileHash(file) });
      chapterList.push({ sourceChapterId: c.id, order: c.order, snapshotId: digest, contentDigest: digest, path: relative });
    }

    const manifest: Manifest = {
      format: 'mvs-publication',
      schemaVersion: VERSION,
      packageId: randomUUID(),
      createdAt: new Date().toISOString(),
      exporterVersion: 'mvs-0.1.0-publication-v1',
      sourceNamespace: snapshot.sourceNamespace,
      sourceProjectId: snapshot.project.id,
      requiredCapabilities: [],
      title: {
        name: snapshot.project.title,
        description: snapshot.metadata.description,
        textLanguage: snapshot.project.textLanguage,
        speechLanguage: snapshot.project.speechLanguage,
        readingDirection: snapshot.project.readingDirection,
        cover,
        credits: snapshot.metadata.credits,
      },
      chapters: chapterList,
      files: files.sort((a, b) => a.path.localeCompare(b.path, 'en')),
      contentDigest: '0'.repeat(64),
    };

    manifest.contentDigest = manifestDigest(manifest);
    validateManifest(manifest);
    await progress('packaging');
    await fs.mkdir(path.dirname(output), { recursive: true });
    const tmp = output + '.' + randomUUID() + '.tmp',
      archive = archiver('zip', { zlib: { level: 6 } }),
      destination = createWriteStream(tmp, { flags: 'wx' });
    const abort = () => {
      archive.abort();
      destination.destroy(new Error('Export cancelled'));
    };

    signal?.addEventListener('abort', abort, { once: true });
    const done = new Promise<void>((resolve, reject) => {
      destination.on('close', resolve);
      destination.on('error', reject);
      archive.on('error', reject);
    });

    archive.pipe(destination);
    archive.append(canonical(manifest), { name: 'manifest.json' });
    for (const [name, source] of assets) {
      archive.file(source, { name });
    }

    try {
      await archive.finalize();
      await done;
      signal?.throwIfAborted();
      await fs.rename(tmp, output);
    } finally {
      signal?.removeEventListener('abort', abort);
      await fs.rm(tmp, { force: true });
    }

    return { contentDigest: manifest.contentDigest, chapters: chapterList.length, bytes: (await fs.stat(output)).size };
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}
