import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { ProjectsRepository } from './projects.repository.js';

@Module({ imports: [PrismaModule], providers: [ProjectsRepository], exports: [ProjectsRepository] })
export class ProjectsDaModule {}
