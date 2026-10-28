import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { PagesDaModule } from '@mvs/backend/modules/pages-da';
import { PageDeletionClModule } from '@mvs/backend/pages';
import { Module } from '@nestjs/common';
import { PagesClModule } from '../pages-cl/pages-cl.module.js';
import { PagesController } from './pages.controller.js';
import { PagesService } from './pages.service.js';

@Module({
  imports: [PagesClModule, PagesDaModule, AccessBlModule, JobEnqueueClModule, PageDeletionClModule],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesBlModule {}
