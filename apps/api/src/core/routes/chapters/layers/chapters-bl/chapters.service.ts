import { AccessService } from '@mvs/backend/access';
import { ApiError, filename, idempotencySchema } from '@mvs/backend/common';
import { JobEnqueueClService } from '@mvs/backend/jobs';
import { ChaptersRepository } from '@mvs/backend/repositories/chapters';
import { storage } from '@mvs/storage';
import { limits } from '@mvs/storage/import';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { type CreateChapterDto, type UpdateChapterDto } from '../../dto/chapters.dto.js';
import { ChaptersClService } from '../chapters-cl/chapters-cl.service.js';

@Injectable()
export class ChaptersService {
  constructor(
    @Inject(ChaptersClService)
    private readonly coordinator: ChaptersClService,
    @Inject(ChaptersRepository)
    private readonly repository: ChaptersRepository,
    @Inject(AccessService)
    private readonly access: AccessService,
    @Inject(JobEnqueueClService)
    private readonly jobs: JobEnqueueClService,
  ) {}

  async createChapter(ownerId: string, projectId: string, input: CreateChapterDto) {
    const p = await this.access.project(ownerId, projectId);
    const v = input;

    return await this.repository.createChapterChapterCreate(p.id, v.title, await this.repository.countChapters(p.id));
  }

  async getChapter(ownerId: string, chapterId: string) {
    const c = await this.repository.getChapterChapterFindUnique(chapterId);

    if (!c) {
      throw new ApiError(404, 'Chapter not found');
    }

    await this.access.project(ownerId, c.projectId);

    return c;
  }

  async updateChapter(ownerId: string, chapterId: string, input: UpdateChapterDto) {
    return this.coordinator.updateChapter(ownerId, chapterId, input);
  }

  async importChapter(ownerId: string, chapterId: string, idempotencyKey: string | undefined, files: Express.Multer.File[]) {
    const c = await this.repository.importChapterChapterFindUnique(chapterId);

    if (!c) {
      throw new ApiError(404, 'Chapter not found');
    }

    await this.access.project(ownerId, c.projectId);
    const key = idempotencySchema.parse(idempotencyKey);

    if (!files?.length || files.reduce((n, f) => n + f.size, 0) > limits.totalBytes) {
      throw new ApiError(422, 'No files were provided or the 500 MiB limit was exceeded');
    }

    const stored = [];

    for (const f of files) {
      const fileKey = c.projectId + '/imports/' + randomUUID();

      await storage.write(fileKey, f.buffer);
      stored.push({ name: filename(f.originalname), key: fileKey });
    }

    const j = await this.jobs.job(ownerId, c.projectId, 'import', { chapterId: c.id, files: stored }, key);

    return { jobId: j.id };
  }
}
