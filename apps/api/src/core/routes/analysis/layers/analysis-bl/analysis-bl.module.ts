import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { AnalysisDaModule } from '@mvs/backend/modules/analysis-da';
import { Module } from '@nestjs/common';
import { AnalysisClModule } from '../analysis-cl/analysis-cl.module.js';
import { AnalysisController } from './analysis.controller.js';
import { AnalysisService } from './analysis.service.js';

@Module({
  imports: [AnalysisClModule, AnalysisDaModule, AccessBlModule, JobEnqueueClModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisBlModule {}
