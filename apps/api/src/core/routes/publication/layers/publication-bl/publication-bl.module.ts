import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { PublicationDaModule } from '@mvs/backend/modules/publication-da';
import { PublicationClModule } from '@mvs/backend/publication';
import { Module } from '@nestjs/common';
import { PublicationController } from './publication.controller.js';
import { PublicationService } from './publication.service.js';

@Module({
  imports: [PublicationDaModule, AccessBlModule, JobEnqueueClModule, PublicationClModule],
  controllers: [PublicationController],
  providers: [PublicationService],
})
export class PublicationBlModule {}
