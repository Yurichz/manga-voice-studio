import { AccessService } from '@mvs/backend/access';
import { ApiError, filename, idempotencySchema, revision } from '@mvs/backend/common';
import { JobEnqueueClService } from '@mvs/backend/jobs';
import { PageDeletionClService } from '@mvs/backend/pages';
import { PagesRepository } from '@mvs/backend/repositories/pages';
import { storage } from '@mvs/storage';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { type DeleteChapterPagesDto, type DeletePageDto, type UpdatePageDto } from '../../dto/pages.dto.js';
import { PagesClService } from '../pages-cl/pages-cl.service.js';

@Injectable()
export class PagesService {
  constructor(
    @Inject(PagesClService)
    private readonly coordinator: PagesClService,
    @Inject(PagesRepository)
    private readonly repository: PagesRepository,
    @Inject(AccessService)
    private readonly access: AccessService,
    @Inject(JobEnqueueClService)
    private readonly jobs: JobEnqueueClService,
    @Inject(PageDeletionClService)
    private readonly deletion: PageDeletionClService,
  ) {}

  async replacePage(
    ownerId: string,
    pageId: string,
    idempotencyKey: string | undefined,
    xConfirmReplace: string | undefined,
    xExpectedRevision: string | undefined,
    file: Express.Multer.File | undefined,
  ) {
    const p = await this.access.page(ownerId, pageId);

    if (xConfirmReplace !== 'true' || !file) {
      throw new ApiError(422, 'Подтвердите удаление связанной разметки');
    }

    const expectedRevision = revision.parse(Number(xExpectedRevision));
    const key = p.projectId + '/imports/' + randomUUID();

    await storage.write(key, file.buffer);
    const j = await this.jobs.job(
      ownerId,
      p.projectId,
      'replace_page',
      { pageId: p.id, inputRevision: expectedRevision, fileKey: key, name: filename(file.originalname) },
      idempotencySchema.parse(idempotencyKey),
    );

    return { jobId: j.id };
  }

  async getPage(ownerId: string, pageId: string) {
    return await this.access.page(ownerId, pageId);
  }

  async updatePage(ownerId: string, pageId: string, input: UpdatePageDto) {
    return this.coordinator.updatePage(ownerId, pageId, input);
  }

  async deletePage(ownerId: string, pageId: string, input: DeletePageDto) {
    const p = await this.access.page(ownerId, pageId);
    const v = input;
    const cancelRequested = await this.deletion.deletePages(ownerId, { id: p.chapterId, projectId: p.projectId }, [
      { id: p.id, expectedRevision: v.expectedRevision },
    ]);

    return { deleted: true, cancelRequested };
  }

  async deleteChapterPages(ownerId: string, chapterId: string, input: DeleteChapterPagesDto) {
    const c = await this.repository.deleteChapterPagesChapterFindUnique(chapterId);

    if (!c) {
      throw new ApiError(404, 'Глава не найдена');
    }

    await this.access.project(ownerId, c.projectId);
    const v = input,
      cancelRequested = await this.deletion.deletePages(ownerId, c, v.pages);

    return { deleted: true, deletedCount: v.pages.length, cancelRequested };
  }
}
