import { Module } from '@nestjs/common';
import { JobsDaModule } from '../jobs-da/jobs-da.module.js';
import { JobProgressService } from './job-progress.service.js';

@Module({ imports: [JobsDaModule], providers: [JobProgressService], exports: [JobProgressService] })
export class JobProgressBlModule {}
