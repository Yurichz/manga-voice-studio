import { PublicationExportRepository } from '@mvs/backend/repositories/publication-export';
import { exportPublication } from '@mvs/publication';
import { storage } from '@mvs/storage';
import { Inject, Injectable } from '@nestjs/common';
import type { JobContext, JobHandler } from '../../../interfaces/job-context.js';

@Injectable()
export class PublicationExportHandler implements JobHandler {
  readonly kinds = ['publication_export'];

  constructor(
    @Inject(PublicationExportRepository)
    private readonly repository: PublicationExportRepository,
  ) {}

  async handle({ job: j, input: v, token, phase }: JobContext) {
    const jobId = j.id;
    let result: any;
    const key = j.projectId + '/publications/' + token + '.mvs-publication.zip';
    const controller = new AbortController();
    const cancellation = setInterval(
      () =>
        void this.repository
          .handleJobFindUnique(jobId)
          .then((current) => {
            if (current?.status !== 'running' || current.attemptToken !== token) {
              controller.abort();
            }
          })
          .catch(() => controller.abort()),
      500,
    );

    try {
      const exported = await exportPublication(v.snapshot, storage.resolve(key), controller.signal, async (name, completed, total) =>
        phase(name, completed, total, completed === undefined ? undefined : 'segments'),
      );
      const current = await this.repository.handleProjectFindUniqueOrThrow(j.projectId);
      const changed =
        current.revision !== v.snapshot.project.revision ||
        (await this.repository.handleChapterFindMany(v.snapshot.chapters.map((c: any) => c.id))).some(
          (c) => v.snapshot.chapters.find((s: any) => s.id === c.id)?.revision !== c.revision,
        );

      result = {
        ...exported,
        fileKey: key,
        snapshotNotice: changed
          ? 'The project changed during export. The archive contains the complete earlier snapshot.'
          : 'The archive contains the selected snapshot.',
      };
    } finally {
      clearInterval(cancellation);
    }

    return { result };
  }
}
