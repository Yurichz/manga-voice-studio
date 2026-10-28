import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';

test('English demo plays four real utterances with sample-based highlighting', async ({ page, request }) => {
  test.skip(process.env.MVS_DEMO_TEST !== 'true', 'Run with the isolated demo API');
  await page.setViewportSize({ width: 1800, height: 1100 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create project' })).toBeDisabled();
  await page.getByRole('button', { name: /^An unexpected quest/ }).click();
  await page.getByLabel('Chapter', { exact: true }).selectOption({ label: 'An unexpected quest' });
  await page.getByRole('button', { name: /1 · A heated exchange/ }).click();
  const project = (await (await request.get('/api/v1/projects')).json())[0];
  expect(project).toMatchObject({ textLanguage: 'en', speechLanguage: 'English', readingDirection: 'rtl' });
  const chapter = project.chapters[0];
  const current = await (await request.get('/api/v1/pages/' + chapter.pages[0].id)).json();
  expect(current.panels).toHaveLength(3);
  expect(current.utterances).toHaveLength(4);
  expect(current.utterances.map((u: any) => u.spokenText)).toEqual([
    'Tyan, why are you always dragging us into this stuff?',
    'Why are you always so unreliable?',
    "Zeon... On second thought, I'm not asking! I'm telling you to find her!",
    "Teen! It's bad omen! Don't pull that again, you raccoon!",
  ]);
  const render = chapter.renders[0];
  expect(render.manifest.sampleRate).toBe(24000);
  expect(render.manifest.segments).toHaveLength(4);
  expect(render.manifest.durationMs).toBeGreaterThan(10000);
  const wav = await request.get('/api/v1/files/' + render.fileKey, { headers: { Range: 'bytes=0-43' } });
  expect(wav.status()).toBe(206);
  expect((await wav.body()).subarray(0, 4).toString()).toBe('RIFF');
  for (const [i, segment] of render.manifest.segments.entries()) {
    expect(segment.utteranceId).toBe(current.utterances[i].id);
    expect(segment.endSample).toBeGreaterThan(segment.startSample);
    expect(segment.startMs).toBe(segment.startSample / 24);
    expect(segment.endMs).toBe(segment.endSample / 24);
  }
  const audio = page.locator('footer audio');
  await expect(audio).toBeVisible();
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.readyState)).toBeGreaterThanOrEqual(2);
  await page.getByLabel('Playback speed').selectOption('1.5');
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.playbackRate)).toBe(1.5);
  await page.getByLabel('Playback speed').selectOption('1');
  await page.getByLabel('Auto-advance').uncheck();
  const selected = current.utterances[2];
  await page.locator('#utterance-' + selected.id).click();
  await expect(page.getByLabel('Spoken text', { exact: true })).toHaveValue(selected.spokenText);
  const start = render.manifest.segments[2].startMs / 1000 + .25;
  await audio.evaluate(async (a: HTMLAudioElement, time: number) => { a.currentTime = time; await a.play(); }, start);
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(start + .2);
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(false);
  await expect(page.locator('rect[data-id="' + selected.id + '"]')).toHaveAttribute('stroke', '#ffd766');
  const image = page.locator('.canvas img');
  await expect.poll(() => image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth === 1561)).toBe(true);
  const bounds = await image.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThan(1030);
  await page.screenshot({ path: 'outputs/ui/demo-english.png', fullPage: true });
  await audio.evaluate((a: HTMLAudioElement) => a.pause());
  expect((await request.get('/api/v1/files/secret/private.wav')).status()).toBe(404);
});

test('demo refuses imports, speech and edits without private services', async ({ request }) => {
  test.skip(process.env.MVS_DEMO_TEST !== 'true', 'Run with the isolated demo API');
  const project = (await (await request.get('/api/v1/projects')).json())[0], chapter = project.chapters[0];
  expect(await (await request.get('/api/v1/projects/' + project.id + '/job-progress')).json()).toEqual({ jobs: [], batches: [] });
  expect((await request.get('/api/v1/projects/foreign/job-progress')).status()).toBe(404);
  expect(await (await request.get('/api/v1/health')).json())
    .toMatchObject({ demo: true, database: 'not required', queue: 'disabled', ai: 'disabled' });
  const imported = await request.post('/api/v1/chapters/' + chapter.id + '/import', {
    multipart: { files: { name: 'forbidden.png', mimeType: 'image/png', buffer: await fs.readFile('docs/assets/demo-manga.png') } },
  });
  expect(imported.status()).toBe(403);
  expect((await imported.json()).error).toEqual({ code: 'DEMO_READ_ONLY', message: 'The demo is read-only' });
  for (const path of ['/projects', '/chapters/' + chapter.id + '/speech', '/chapters/' + chapter.id + '/render', '/projects/' + project.id + '/voices/design']) {
    const r = await request.post('/api/v1' + path, { data: {} });
    expect(r.status()).toBe(403);
    expect((await r.json()).error.code).toBe('DEMO_READ_ONLY');
  }
  expect((await request.patch('/api/v1/projects/' + project.id, { data: { title: 'Rejected' } })).status()).toBe(403);
});
