import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function startDemo() {
  const root = path.resolve(process.env.DEMO_ROOT || 'storage/demo-english');
  const data = JSON.parse(await fs.readFile(path.join(root, 'demo.json'), 'utf8'));
  const app = express();

  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.status(403).json({ error: { code: 'DEMO_READ_ONLY', message: 'The demo is read-only' } });

      return;
    }

    next();
  });
  app.get('/health/live', (_req, res) => res.json({ alive: true, demo: true }));
  app.get('/api/v1/me', (_req, res) => res.json({ ownerId: 'demo', demo: true }));
  app.get('/api/v1/projects', (_req, res) => res.json([data.project]));
  app.get('/api/v1/projects/:id', (req, res) => (req.params.id === data.project.id ? res.json(data.project) : res.sendStatus(404)));
  app.get('/api/v1/chapters/:id', (req, res) => (req.params.id === data.chapter.id ? res.json(data.chapter) : res.sendStatus(404)));
  app.get('/api/v1/pages/:id', (req, res) => {
    const page = data.pages.find((p: any) => p.id === req.params.id);

    if (page) {
      res.json(page);
    } else {
      res.sendStatus(404);
    }
  });
  app.get('/api/v1/projects/:id/job-progress', (req, res) =>
    req.params.id === data.project.id ? res.json({ jobs: [], batches: [] }) : res.sendStatus(404),
  );
  app.get('/api/v1/projects/:id/jobs', (_req, res) => res.json([]));
  app.get('/api/v1/projects/:id/artifacts', (_req, res) => res.json(data.artifacts));
  app.get('/api/v1/pages/:id/analyses', (_req, res) => res.json([]));
  app.get('/api/v1/health', (_req, res) =>
    res.json({ api: 'ready', demo: true, database: 'not required', queue: 'disabled', ai: 'disabled' }),
  );
  const whitelist = new Map<string, string>(data.files.map((f: string) => [f, path.join(root, path.basename(f))]));

  app.get('/api/v1/files/:projectId/*key', (req, res) => {
    const key = req.params.projectId + '/' + req.params.key.join('/');
    const file = whitelist.get(key);

    if (!file) {
      return res.sendStatus(404);
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(file);
  });
  await new Promise<void>((resolve, reject) => {
    app.listen(3001, '127.0.0.1', (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  console.log('Isolated read-only demo API: 127.0.0.1:3001');
}
