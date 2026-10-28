import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { db } from '@mvs/database';
import { makeAuth } from '@mvs/backend/auth';
import { PrismaService } from '@mvs/backend/prisma';
import { ProjectsRepository } from '@mvs/backend/repositories/projects';
import { storage } from '@mvs/storage';
import { speechInput } from '@mvs/contracts';
import { inputHash, prepareSpeechTexts } from '@mvs/contracts/server';
import { validateManifest } from '@mvs/publication-format';
import yauzl from 'yauzl';

describe.skipIf(process.env.MVS_RUN_INTEGRATION !== 'true')('Nest migration compatibility against real isolated services', () => {
  const origin = process.env.BETTER_AUTH_URL!;
  const users: string[] = [];
  let cookie: string, foreignCookie: string, ownerId: string, projectId: string;
  async function account() {
    const email = randomUUID() + '@nest-test.invalid';
    const password = randomBytes(24).toString('base64url');
    const { user } = await makeAuth(true).api.signUpEmail({ body: { email, password, name: 'Nest fixture' } });
    users.push(user.id);
    const response = await fetch(origin + '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(response.status).toBe(200);
    return {
      id: user.id,
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
  }
  async function request(endpoint: string, method = 'GET', body?: unknown, session = cookie, extra: Record<string, string> = {}) {
    return fetch(origin + '/api/v1' + endpoint, {
      method,
      headers: { Cookie: session, Origin: origin, 'Content-Type': 'application/json', ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  beforeAll(async () => {
    expect(new URL(process.env.DATABASE_URL!).pathname).toMatch(/^\/kelly_test_/);
    const first = await account(),
      second = await account();
    ownerId = first.id;
    cookie = first.cookie;
    foreignCookie = second.cookie;
    const created = await request('/projects', 'POST', { title: 'Nest regression', ownerId: second.id });
    expect(created.status).toBe(201);
    const project = (await created.json()) as any;
    expect(project.ownerId).toBe(ownerId);
    expect(project.success).toBeUndefined();
    projectId = project.id;
  });
  afterAll(async () => {
    if (projectId) {
      await db.utterance.deleteMany({ where: { projectId } });
      await db.project.deleteMany({ where: { id: projectId } });
      await storage.removeProject(projectId);
    }
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });
  it('preserves sessions, DTO errors, origins, request IDs and raw response bodies', async () => {
    expect(await (await request('/me')).json()).toEqual({ ownerId, demo: false });
    const unauthorized = await request('/projects', 'GET', undefined, '');
    expect(unauthorized.status).toBe(401);
    expect(((await unauthorized.json()) as any).error.requestId).toBe(unauthorized.headers.get('X-Request-Id'));
    const invalid = await request('/projects', 'POST', { title: '' });
    expect(invalid.status).toBe(422);
    expect(((await invalid.json()) as any).error.code).toBe('VALIDATION_ERROR');
    expect((await request('/projects/invalid')).status).toBe(422);
    expect((await request('/projects/' + projectId, 'GET', undefined, foreignCookie)).status).toBe(404);
    expect((await request('/projects', 'POST', { title: 'Forbidden' }, cookie, { Origin: 'http://foreign.invalid' })).status).toBe(403);
    const malformed = await fetch(origin + '/api/v1/projects', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as any).error.code).toBe('REQUEST_FAILED');
  });
  it('documents every migrated route with the same DTOs and actual success statuses', async () => {
    const response = await request('/openapi');
    expect(response.status).toBe(200);
    const document = (await response.json()) as any;
    const routes = JSON.parse(await readFile('tests/fixtures/nest-api-routes.json', 'utf8')) as {
      path: string;
      method: string;
      status: number;
    }[];
    for (const route of routes) {
      const name = route.path.replace(/:(\w+)/g, '{$1}').replace('*key', '{key}');
      const operation = document.paths[name]?.[route.method];
      expect(operation, route.method + ' ' + name).toBeDefined();
      expect(operation.responses[String(route.status)]).toBeDefined();
    }
    expect(document.servers).toEqual([{ url: '/api/v1' }]);
    expect(
      document.paths['/jobs/{jobId}/save-voice'].post.requestBody.content['application/json'].schema.properties.profileId,
    ).toBeDefined();
    expect(
      document.paths['/projects/{projectId}/publication-export'].post.requestBody.content['application/json'].schema.properties.chapterIds,
    ).toBeDefined();
  });
  it('keeps private downloads and byte ranges compatible', async () => {
    const file = projectId + '/audio/fixture.wav';
    await storage.write(file, Buffer.from('RIFF' + '0'.repeat(60)));
    const response = await request('/files/' + file, 'GET', undefined, cookie, { Range: 'bytes=0-3' });
    expect(response.status).toBe(206);
    expect(await response.text()).toBe('RIFF');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect((await request('/files/' + file, 'GET', undefined, foreignCookie)).status).toBe(404);
    expect((await request('/files/' + projectId + '/sources/hidden.png')).status).toBe(404);
    expect((await request('/files/' + projectId + '/audio/missing.wav')).status).toBe(404);
  });
  it('rolls back repository writes and reuses explicit clients on PostgreSQL', async () => {
    const prisma = new PrismaService();
    const repository = new ProjectsRepository(prisma);
    const title = 'Must rollback ' + randomUUID();
    await expect(
      prisma.$tx(async (client) => {
        const created = await repository.createProjectProjectCreate(
          { title, textLanguage: 'ru', speechLanguage: 'Russian', readingDirection: 'ltr' },
          ownerId,
        );
        await prisma.$txe(async () => {
          const projects = await repository.tx(client).listProjectsProjectFindMany(ownerId);
          expect(projects.some((project) => project.id === created.id)).toBe(true);
        }, client);
        throw new Error('expected rollback');
      }),
    ).rejects.toThrow('expected rollback');
    expect(await db.project.count({ where: { title } })).toBe(0);
  });
  it('renders and exports an immutable publication using an explicit recorded-audio fixture', async () => {
    // This is a cache/encoding fixture, not a claim that this test ran TTS inference.
    const chapter = await db.chapter.create({ data: { projectId, title: 'Publication fixture', order: 0 } });
    const imageKey = projectId + '/fixture.png',
      audioKey = projectId + '/audio/recorded.wav';
    const image = await readFile('work/fixtures/chapter-1.png'),
      audio = await readFile('storage/demo/speech-1.wav');
    let sampleRate = 0,
      blockAlign = 0,
      dataBytes = 0;
    for (let offset = 12; offset + 8 <= audio.length; ) {
      const size = audio.readUInt32LE(offset + 4),
        chunk = audio.subarray(offset, offset + 4).toString();
      if (chunk === 'fmt ') {
        sampleRate = audio.readUInt32LE(offset + 12);
        blockAlign = audio.readUInt16LE(offset + 20);
      }
      if (chunk === 'data') {
        dataBytes = size;
      }
      offset += 8 + size + (size % 2);
    }
    const sampleCount = dataBytes / blockAlign;
    expect(sampleRate).toBe(24000);
    expect(sampleCount).toBeGreaterThan(0);
    await storage.write(imageKey, image);
    await storage.write(audioKey, audio);
    const page = await db.page.create({
      data: {
        projectId,
        chapterId: chapter.id,
        order: 0,
        name: 'Owned fixture',
        width: 800,
        height: 1000,
        imageKey,
        previewKey: imageKey,
        sourceKey: imageKey,
        checksum: createHash('sha256').update(image).digest('hex'),
        transform: {},
      },
    });
    const profile = await db.voiceProfile.create({ data: { projectId, name: 'Recorded fixture' } });
    const voice = await db.voiceProfileVersion.create({
      data: {
        projectId,
        profileId: profile.id,
        referenceKey: audioKey,
        checksum: createHash('sha256').update(audio).digest('hex'),
        transcript: 'Привет! Начнём историю.',
        language: 'Russian',
        modelRevision: 'explicit-recorded-fixture',
        settings: { rightsConfirmed: true },
      },
    });
    const utterance = await db.utterance.create({
      data: {
        id: randomUUID(),
        projectId,
        pageId: page.id,
        order: 0,
        bbox: { x: 0.1, y: 0.1, width: 0.4, height: 0.2 },
        originalText: voice.transcript,
        spokenText: voice.transcript,
        voiceVersionId: voice.id,
        reviewStatus: 'reviewed',
        included: true,
        pauseMs: 0,
      },
    });
    const [prepared] = await prepareSpeechTexts([utterance.spokenText], 'Russian');
    const canonical = speechInput(ownerId, projectId, utterance, voice, 'Russian', prepared);
    const artifact = await db.audioArtifact.create({
      data: {
        projectId,
        ownerId,
        utteranceId: utterance.id,
        inputHash: inputHash(canonical),
        snapshot: { canonical },
        fileKey: audioKey,
        sourceKey: audioKey,
        duration: sampleCount / sampleRate,
        sampleRate,
        sampleCount,
        modelRevision: canonical.modelRevision,
      },
    });
    await db.utterance.update({ where: { id: utterance.id }, data: { activeAudioId: artifact.id } });
    async function finished(jobId: string) {
      for (let attempt = 0; attempt < 60; attempt++) {
        const job = (await (await request('/jobs/' + jobId)).json()) as any;
        if (['succeeded', 'failed', 'blocked', 'cancelled'].includes(job.status)) {
          expect(job.status, job.error).toBe('succeeded');
          return job;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error('Publication fixture job timed out');
    }
    const queuedRender = await request('/chapters/' + chapter.id + '/render', 'POST', {}, cookie, { 'Idempotency-Key': randomUUID() });
    expect(queuedRender.status).toBe(202);
    await finished(((await queuedRender.json()) as any).jobId);
    const preview = (await (await request('/projects/' + projectId + '/publication-preview')).json()) as any;
    expect(preview.chapters.find((item: any) => item.chapterId === chapter.id).ready).toBe(true);
    const queued = await request(
      '/projects/' + projectId + '/publication-export',
      'POST',
      { chapterIds: [chapter.id], coverPageId: page.id },
      cookie,
      { 'Idempotency-Key': randomUUID() },
    );
    expect(queued.status).toBe(202);
    expect((await request('/projects/' + projectId, 'PATCH', { title: 'Edited after snapshot', expectedRevision: 0 })).status).toBe(200);
    const job = await finished(((await queued.json()) as any).jobId);
    expect(job.input.snapshot.project.title).toBe('Nest regression');
    const download = await request('/files/' + job.result.fileKey);
    expect(download.status).toBe(200);
    const archive = Buffer.from(await download.arrayBuffer());
    const manifest = await new Promise<any>((resolve, reject) =>
      yauzl.fromBuffer(archive, { lazyEntries: true }, (error, zip) => {
        if (error) {
          reject(error);
          return;
        }
        zip.on('error', reject);
        zip.on('end', () => reject(new Error('Missing publication manifest')));
        zip.on('entry', (entry) => {
          if (entry.fileName !== 'manifest.json') {
            zip.readEntry();
            return;
          }
          zip.openReadStream(entry, (error, stream) => {
            if (error) {
              reject(error);
              return;
            }
            const chunks: Buffer[] = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => {
              try {
                resolve(JSON.parse(Buffer.concat(chunks).toString()));
              } catch (error) {
                reject(error);
              } finally {
                zip.close();
              }
            });
          });
        });
        zip.readEntry();
      }),
    );
    expect(validateManifest(manifest).title.name).toBe('Nest regression');
    expect(manifest.contentDigest).toBe(job.result.contentDigest);
    expect(manifest.chapters).toHaveLength(1);
  }, 45000);
  it('keeps logout and project deletion semantics', async () => {
    const deletion = await request('/projects/' + projectId, 'DELETE');
    expect(deletion.status).toBe(202);
    expect(await deletion.json()).toEqual({ deleted: true });
    expect((await request('/projects/' + projectId)).status).toBe(404);
    const logout = await fetch(origin + '/api/auth/sign-out', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(logout.status).toBe(200);
    expect((await request('/me')).status).toBe(401);
  });
});
