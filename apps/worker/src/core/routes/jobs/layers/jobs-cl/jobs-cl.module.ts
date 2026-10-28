import { JobsDaModule } from '@mvs/backend/modules/jobs-da';
import { Module } from '@nestjs/common';
import { JobPublicationClService } from './job-publication-cl.service.js';
import { RenderSnapshotClService } from './render-snapshot-cl.service.js';

@Module({
  imports: [JobsDaModule],
  providers: [JobPublicationClService, RenderSnapshotClService],
  exports: [JobPublicationClService, RenderSnapshotClService],
})
export class JobsClModule {}
