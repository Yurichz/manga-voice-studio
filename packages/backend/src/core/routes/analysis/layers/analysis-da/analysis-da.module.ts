import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { AnalysisRepository } from './analysis.repository.js';

@Module({ imports: [PrismaModule], providers: [AnalysisRepository], exports: [AnalysisRepository] })
export class AnalysisDaModule {}
