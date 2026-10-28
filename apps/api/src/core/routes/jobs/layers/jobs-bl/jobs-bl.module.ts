import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { JobsDaModule } from '@mvs/backend/modules/jobs-da';
import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

@Module({ imports: [JobsDaModule, AccessBlModule, JobEnqueueClModule], controllers: [JobsController], providers: [JobsService] })
export class JobsBlModule {}
