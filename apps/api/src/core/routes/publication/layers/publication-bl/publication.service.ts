import { AccessService } from '@mvs/backend/access';
import { ApiError, idempotencySchema } from '@mvs/backend/common';
import { JobEnqueueClService } from '@mvs/backend/jobs';
import { PublicationClService } from '@mvs/backend/publication';
import { PublicationError } from '@mvs/publication';
import { Inject, Injectable } from '@nestjs/common';
import { type ExportPublicationDto } from '../../dto/publication.dto.js';

@Injectable()
export class PublicationService {
  constructor(
    @Inject(AccessService)
    private readonly access: AccessService,
    @Inject(JobEnqueueClService)
    private readonly jobs: JobEnqueueClService,
    @Inject(PublicationClService)
    private readonly publication: PublicationClService,
  ) {}

  async previewPublication(ownerId: string, projectId: string) {
    const p = await this.access.project(ownerId, projectId);

    return await this.publication.publicationPreview(p);
  }

  async exportPublication(ownerId: string, projectId: string, input: ExportPublicationDto, idempotencyKey: string | undefined) {
    const p = await this.access.project(ownerId, projectId);
    const v = input;

    try {
      const snapshot = await this.publication.capturePublication(ownerId, p.id, v.chapterIds, {
        description: v.description,
        credits: v.credits,
        coverPageId: v.coverPageId,
      });
      const j = await this.jobs.job(ownerId, p.id, 'publication_export', { snapshot }, idempotencySchema.parse(idempotencyKey));

      return { jobId: j.id, snapshotNotice: 'Export is pinned to the selected snapshot. Later changes will not be included.' };
    } catch (e) {
      if (e instanceof PublicationError) {
        throw new ApiError(422, e.field + ': ' + e.message);
      }

      throw e;
    }
  }
}
