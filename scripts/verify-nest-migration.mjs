import assert from 'node:assert/strict';
import { spawn, fork } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const gpu = process.argv.includes('--gpu');
const browser = process.argv.includes('--browser');
const browserOnly = process.argv.includes('--only-browser');
const token = randomUUID().slice(0, 8);
const directory = path.join(root, 'work', 'nest-verification', token);
await mkdir(directory, { recursive: true });
const docker = process.env.MVS_DOCKER || path.join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe');
const containers = [`mvs-nest-pg-${token}`, `mvs-nest-redis-${token}`];
const children = [];
const environment = { ...process.env };
const report = { gpu, browser, directory, started: new Date().toISOString(), passed: false };
async function command(executable, args, env = environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: root, env, windowsHide: true });
    const output = [];
    const errors = [];
    child.stdout.on('data', (chunk) => output.push(chunk));
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(Buffer.concat(output).toString().trim())
      : reject(Object.assign(new Error(`${path.basename(executable)} failed (${code}): ${Buffer.concat(errors).toString().slice(-2500)}`), {
        stdout: Buffer.concat(output).toString(), stderr: Buffer.concat(errors).toString(),
      })));
  });
}
async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function waitFor(probe, description, seconds = 60) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try { if (await probe()) { return; } } catch { /* readiness is retried */ }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${description}`);
}
async function application(mode) {
  const output = createWriteStream(path.join(directory, `${mode}.log`));
  const child = fork('scripts/verify-nest-process.mjs', [mode], { env: environment, silent: true, windowsHide: true });
  child.stdout.pipe(output);
  child.stderr.pipe(output);
  children.push(child);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${mode} startup timed out`)), 30000);
    child.once('error', reject);
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`${mode} exited during startup (${code})`)); });
    child.on('message', (message) => { if (message.ready) { clearTimeout(timeout); resolve(); } });
  });
  return child;
}
try {
  await command(docker, ['info', '--format', '{{.ServerVersion}}']);
  console.log('Starting isolated PostgreSQL/pgvector and Redis containers.');
  const password = randomBytes(24).toString('hex');
  const compose = await readFile('compose.yaml', 'utf8');
  const postgresImage = /image: (pgvector\/[^\r\n]+)/.exec(compose)[1];
  const redisImage = /image: (redis:[^\r\n]+)/.exec(compose)[1];
  await command(docker, ['run', '--rm', '--detach', '--name', containers[0], '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_USER=mvs_test', '--env', `POSTGRES_PASSWORD=${password}`, '--env', `POSTGRES_DB=kelly_test_nest_${token}`, postgresImage]);
  await command(docker, ['run', '--rm', '--detach', '--name', containers[1], '--publish', '127.0.0.1::6379', redisImage]);
  const inspectPort = async (name, port) => {
    const data = JSON.parse(await command(docker, ['inspect', name]));
    return data[0].NetworkSettings.Ports[port + '/tcp'][0].HostPort;
  };
  const postgresPort = await inspectPort(containers[0], 5432);
  const redisPort = await inspectPort(containers[1], 6379);
  environment.DATABASE_URL = `postgresql://mvs_test:${password}@127.0.0.1:${postgresPort}/kelly_test_nest_${token}`;
  environment.TEST_DATABASE_URL = environment.DATABASE_URL;
  environment.REDIS_URL = `redis://127.0.0.1:${redisPort}`;
  environment.MVS_QUEUE_NAME = `mvs-nest-${token}`;
  environment.STORAGE_ROOT = path.join(directory, 'storage');
  environment.BETTER_AUTH_SECRET = randomBytes(32).toString('hex');
  environment.AI_SECRET = randomBytes(32).toString('hex');
  environment.API_PORT = browser ? '3001' : String(await unusedPort());
  environment.BETTER_AUTH_URL = browser ? 'http://localhost:3000' : `http://127.0.0.1:${environment.API_PORT}`;
  environment.AI_URL = `http://127.0.0.1:${await unusedPort()}`;
  environment.MVS_RUN_INTEGRATION = 'true';
  environment.MVS_INTEGRATION_GPU = gpu ? 'true' : 'false';
  environment.NEXT_TELEMETRY_DISABLED = '1';
  environment.MVS_E2E_FULL = 'false';
  environment.PLAYWRIGHT_BROWSERS_PATH = path.join(root, '.cache', 'playwright');
  await waitFor(async () => (await command(docker, ['exec', containers[0], 'pg_isready', '-U', 'mvs_test'])).includes('accepting'), 'PostgreSQL');
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'packages/database/prisma/schema.prisma']);
  console.log('Migrations applied to the isolated database. Starting real AI supervisor.');
  const aiLog = createWriteStream(path.join(directory, 'ai.log'));
  const ai = spawn(path.join(root, '.runtime', 'ai', 'Scripts', 'python.exe'), ['-m', 'uvicorn', 'services.ai.supervisor:app', '--host', '127.0.0.1', '--port', new URL(environment.AI_URL).port], { cwd: root, env: environment, windowsHide: true });
  ai.stdout.pipe(aiLog);
  ai.stderr.pipe(aiLog);
  children.push(ai);
  await waitFor(async () => (await fetch(environment.AI_URL + '/health', { headers: { 'X-AI-Secret': environment.AI_SECRET } })).ok, 'AI supervisor');
  await application('api');
  await application('worker');
  if (browser) {
    const webLog = createWriteStream(path.join(directory, 'web.log'));
    const web = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', 'apps/web', '--hostname', '127.0.0.1', '--port', '3000'], {
      cwd: root, env: environment, windowsHide: true,
    });
    web.stdout.pipe(webLog);
    web.stderr.pipe(webLog);
    children.push(web);
    await waitFor(async () => (await fetch(environment.BETTER_AUTH_URL)).ok, 'Next.js');
  }
  const origin = environment.BETTER_AUTH_URL;
  assert.equal((await fetch(origin + '/health/live')).status, 200);
  assert.equal((await fetch(origin + '/api/v1/projects')).status, 401);
  console.log(`Running existing integration tests${gpu ? ' with real GPU models' : ' without GPU inference'}.`);
  const results = [];
  for (const file of browserOnly ? [] : ['tests/integration/page-deletion.test.ts', 'tests/integration/scenario.test.ts',
    'tests/integration/pronunciation.test.ts', 'tests/nest-migration.test.ts']) {
    if (results.length) { await delay(11000); }
    console.log(`Checking ${file}`);
    const result = await command(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', file]);
    results.push(result);
    await writeFile(path.join(directory, 'tests.log'), results.join('\n'));
    console.log(result);
  }
  if (browser) {
    console.log('Checking the existing editor and real browser regressions.');
    const result = await command(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--workers=1']);
    await writeFile(path.join(directory, 'browser.log'), result);
    console.log(result);
  }
  report.passed = true;
} catch (error) {
  report.error = error.message;
  if (error.stdout) { await writeFile(path.join(directory, 'failed-test.log'), error.stdout + '\n' + error.stderr); }
  console.error(error.message);
  process.exitCode = 1;
} finally {
  // A failed GPU assertion must not leave its owned inference subprocess alive.
  if (environment.AI_URL && environment.AI_SECRET) {
    try {
      const health = await fetch(environment.AI_URL + '/health', {
        headers: { 'X-AI-Secret': environment.AI_SECRET }, signal: AbortSignal.timeout(3000),
      }).then((response) => response.json());
      if (health.activeJob) {
        await fetch(environment.AI_URL + '/cancel/' + encodeURIComponent(health.activeJob), {
          method: 'POST', headers: { 'X-AI-Secret': environment.AI_SECRET }, signal: AbortSignal.timeout(5000),
        });
      }
    } catch { /* The supervisor may not have started. */ }
  }
  // Stop the worker before API/AI/database so all active resources can close normally.
  for (const child of [...children].reverse()) {
    if (child.exitCode !== null) { continue; }
    if (child.connected) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.send('close');
      await Promise.race([exited, delay(15000)]);
      if (child.exitCode !== null) { continue; }
      report.passed = false;
      report.error = 'A Nest application did not terminate after app.close()';
      process.exitCode = 1;
    }
    child.kill();
  }
  for (const container of containers.reverse()) { await command(docker, ['stop', '--time', '5', container]).catch(() => undefined); }
  report.finished = new Date().toISOString();
  await writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Verification report: ${path.relative(root, directory)}`);
}
