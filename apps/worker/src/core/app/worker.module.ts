import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { JobsBlModule } from '../routes/jobs/layers/jobs-bl/jobs-bl.module.js';

@Module({ imports: [PrismaModule, JobsBlModule] })
export class WorkerModule {}
