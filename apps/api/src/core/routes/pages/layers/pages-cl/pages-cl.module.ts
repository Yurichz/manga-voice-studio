import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { PagesDaModule } from '@mvs/backend/modules/pages-da';
import { PageDeletionClModule } from '@mvs/backend/pages';
import { Module } from '@nestjs/common';
import { PagesClService } from './pages-cl.service.js';

@Module({
  imports: [PagesDaModule, AccessBlModule, JobEnqueueClModule, PageDeletionClModule],
  providers: [PagesClService],
  exports: [PagesClService],
})
export class PagesClModule {}
