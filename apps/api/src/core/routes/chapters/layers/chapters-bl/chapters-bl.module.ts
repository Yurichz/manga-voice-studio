import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { ChaptersDaModule } from '@mvs/backend/modules/chapters-da';
import { Module } from '@nestjs/common';
import { ChaptersClModule } from '../chapters-cl/chapters-cl.module.js';
import { ChaptersController } from './chapters.controller.js';
import { ChaptersService } from './chapters.service.js';

@Module({
  imports: [ChaptersClModule, ChaptersDaModule, AccessBlModule, JobEnqueueClModule],
  controllers: [ChaptersController],
  providers: [ChaptersService],
})
export class ChaptersBlModule {}
