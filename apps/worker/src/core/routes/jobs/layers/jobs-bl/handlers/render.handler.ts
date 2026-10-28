import { storage } from '@mvs/storage';
import { Inject, Injectable } from '@nestjs/common';
import archiver from 'archiver';
import type { JobContext, JobHandler } from '../../../interfaces/job-context.js';
import { RenderSnapshotClService } from '../../jobs-cl/render-snapshot-cl.service.js';

@Injectable()
export class RenderHandler implements JobHandler {
  readonly kinds = ['render'];

  constructor(
    @Inject(RenderSnapshotClService)
    private readonly snapshots: RenderSnapshotClService,
  ) {}

  async handle({ job: j, token, phase, runAI }: JobContext) {
    const extra = await this.snapshots.snapshotRender(j);
    const result = await runAI('render', extra);
    const key = j.projectId + '/renders/' + token + '.zip';

    await phase('packaging', 0, extra.segments.length, 'segments');
    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    const buffer = new Promise<Buffer>((resolve, reject) => {
      archive.on('data', (b: Buffer) => chunks.push(b));
      archive.on('error', reject);
      archive.on('end', () => resolve(Buffer.concat(chunks)));
    });

    archive.append(JSON.stringify(result.manifest, null, 2), { name: 'manifest.json' });
    for (const [i, s] of extra.segments.entries()) {
      archive.append(await storage.read(s.fileKey), { name: `utterances/${String(i + 1).padStart(3, '0')}-${s.utteranceId}.wav` });
      await phase('packaging', i + 1, extra.segments.length, 'segments');
    }

    await archive.finalize();
    await storage.write(key, await buffer);
    result.zipKey = key;

    return { result, extra };
  }
}
