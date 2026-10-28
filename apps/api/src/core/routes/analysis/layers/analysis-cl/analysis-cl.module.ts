import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { AnalysisDaModule } from '@mvs/backend/modules/analysis-da';
import { Module } from '@nestjs/common';
import { AnalysisClService } from './analysis-cl.service.js';

@Module({ imports: [AnalysisDaModule, AccessBlModule, JobEnqueueClModule], providers: [AnalysisClService], exports: [AnalysisClService] })
export class AnalysisClModule {}
