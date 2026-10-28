import { AccessBlModule } from '@mvs/backend/access';
import { ProjectsDaModule } from '@mvs/backend/modules/projects-da';
import { Module } from '@nestjs/common';
import { ProjectsClModule } from '../projects-cl/projects-cl.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({ imports: [ProjectsClModule, ProjectsDaModule, AccessBlModule], controllers: [ProjectsController], providers: [ProjectsService] })
export class ProjectsBlModule {}
