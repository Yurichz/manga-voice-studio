import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { ChaptersDaModule } from '@mvs/backend/modules/chapters-da';
import { Module } from '@nestjs/common';
import { ChaptersClService } from './chapters-cl.service.js';

@Module({ imports: [ChaptersDaModule, AccessBlModule, JobEnqueueClModule], providers: [ChaptersClService], exports: [ChaptersClService] })
export class ChaptersClModule {}
