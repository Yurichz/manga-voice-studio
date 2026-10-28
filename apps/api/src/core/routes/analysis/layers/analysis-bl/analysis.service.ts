import { AccessService } from '@mvs/backend/access';
import { idempotencySchema } from '@mvs/backend/common';
import { JobEnqueueClService } from '@mvs/backend/jobs';
import { AnalysisRepository } from '@mvs/backend/repositories/analysis';
import { Inject, Injectable } from '@nestjs/common';
import { type ApplyAnalysisDto, type FindCandidatesDto } from '../../dto/analysis.dto.js';
import { AnalysisClService } from '../analysis-cl/analysis-cl.service.js';

@Injectable()
export class AnalysisService {
  constructor(
    @Inject(AnalysisClService)
    private readonly coordinator: AnalysisClService,
    @Inject(AnalysisRepository)
    private readonly repository: AnalysisRepository,
    @Inject(AccessService)
    private readonly access: AccessService,
    @Inject(JobEnqueueClService)
    private readonly jobs: JobEnqueueClService,
  ) {}

  async findCandidates(ownerId: string, pageId: string, input: FindCandidatesDto, idempotencyKey: string | undefined) {
    const p = await this.access.page(ownerId, pageId);
    const v = input;
    const j = await this.jobs.job(
      ownerId,
      p.projectId,
      'candidates',
      { pageId: p.id, imageKey: p.imageKey, bbox: v.bbox },
      idempotencySchema.parse(idempotencyKey),
    );

    return { jobId: j.id };
  }

  async analysePage(ownerId: string, pageId: string, idempotencyKey: string | undefined) {
    const p = await this.access.page(ownerId, pageId);
    const j = await this.jobs.job(
      ownerId,
      p.projectId,
      'analysis',
      {
        pageId: p.id,
        imageKey: p.imageKey,
        inputRevision: p.revision,
        textLanguage: (await this.access.project(ownerId, p.projectId)).textLanguage,
        readingDirection:
          (await this.repository.analysePageChapterFindUnique(p.chapterId))?.readingDirection ||
          (await this.access.project(ownerId, p.projectId)).readingDirection,
      },
      idempotencySchema.parse(idempotencyKey),
    );

    return { jobId: j.id };
  }

  async listAnalyses(ownerId: string, pageId: string) {
    const p = await this.access.page(ownerId, pageId);

    return await this.repository.listAnalysesAnalysisRunFindMany(p.id);
  }

  async applyAnalysis(ownerId: string, analysisId: string, input: ApplyAnalysisDto) {
    return this.coordinator.applyAnalysis(ownerId, analysisId, input);
  }
}
