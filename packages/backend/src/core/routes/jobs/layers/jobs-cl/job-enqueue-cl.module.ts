import { Module } from '@nestjs/common';
import { AccessBlModule } from '../../../access/layers/access-bl/access.module.js';
import { JobsDaModule } from '../jobs-da/jobs-da.module.js';
import { JobEnqueueClService } from './job-enqueue-cl.service.js';

@Module({ imports: [JobsDaModule, AccessBlModule], providers: [JobEnqueueClService], exports: [JobEnqueueClService] })
export class JobEnqueueClModule {}
