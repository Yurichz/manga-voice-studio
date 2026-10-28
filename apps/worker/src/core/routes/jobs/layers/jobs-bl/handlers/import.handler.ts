import { json } from '@mvs/backend/common';
import { ImportRepository } from '@mvs/backend/repositories/import';
import { storage } from '@mvs/storage';
import { isZip, limits, normalize, unpack } from '@mvs/storage/import';
import { Inject, Injectable } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import type { JobContext, JobHandler } from '../../../interfaces/job-context.js';

@Injectable()
export class ImportHandler implements JobHandler {
  readonly kinds = ['import'];

  constructor(
    @Inject(ImportRepository)
    private readonly repository: ImportRepository,
  ) {}

  async handle({ job: j, input: v, token, phase }: JobContext) {
    await phase('unpacking');
    const files = [];

    for (const f of v.files) {
      const data = await storage.read(f.key);

      if (isZip(data)) {
        files.push(...(await unpack(data)));
      } else {
        files.push({ name: f.name, data });
      }
    }

    files.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    if (files.length > limits.pages || files.reduce((n, f) => n + f.data.length, 0) > limits.totalBytes) {
      throw new UnrecoverableError('Превышены лимиты импорта');
    }

    const existing = await this.repository.handlePageCount(v.chapterId);

    if (existing + files.length > limits.pages) {
      throw new UnrecoverableError('В главе максимум 50 страниц');
    }

    const extra = [];

    await phase('normalizing', 0, files.length, 'pages');
    for (const [i, f] of files.entries()) {
      const n = await normalize(f.data);
      const base = j.projectId + '/pages/' + token + '/' + i;

      await storage.write(base + '.png', n.canonical);
      await storage.write(base + '.webp', n.preview);
      await storage.write(j.projectId + '/sources/' + token + '/' + i, f.data);
      extra.push({
        chapterId: v.chapterId,
        projectId: j.projectId,
        order: existing + i,
        name: f.name,
        width: n.width,
        height: n.height,
        checksum: n.checksum,
        transform: json(n.transform),
        imageKey: base + '.png',
        previewKey: base + '.webp',
        sourceKey: j.projectId + '/sources/' + token + '/' + i,
      });
      await phase('normalizing', i + 1, files.length, 'pages');
    }

    const result = { pages: extra.length, warnings: [] };

    return { result, extra };
  }
}
