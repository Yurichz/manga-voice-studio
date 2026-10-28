import { json } from '@mvs/backend/common';
import { storage } from '@mvs/storage';
import { normalize } from '@mvs/storage/import';
import { Injectable } from '@nestjs/common';
import type { JobContext, JobHandler } from '../../../interfaces/job-context.js';

@Injectable()
export class ReplacePageHandler implements JobHandler {
  readonly kinds = ['replace_page'];

  constructor() {}

  async handle({ job: j, input: v, token, phase }: JobContext) {
    await phase('normalizing', 0, 1, 'pages');
    const n = await normalize(await storage.read(v.fileKey));
    const base = j.projectId + '/pages/' + token + '/replacement';

    await storage.write(base + '.png', n.canonical);
    await storage.write(base + '.webp', n.preview);
    await storage.write(j.projectId + '/sources/' + token + '/replacement', await storage.read(v.fileKey));
    const extra = {
      name: v.name,
      width: n.width,
      height: n.height,
      checksum: n.checksum,
      transform: json(n.transform),
      imageKey: base + '.png',
      previewKey: base + '.webp',
      sourceKey: j.projectId + '/sources/' + token + '/replacement',
    };
    const result = { replaced: true };

    return { result, extra };
  }
}
