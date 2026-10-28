import { AccessBlModule } from '@mvs/backend/access';
import { ProjectsDaModule } from '@mvs/backend/modules/projects-da';
import { Module } from '@nestjs/common';
import { ProjectsClService } from './projects-cl.service.js';

@Module({ imports: [ProjectsDaModule, AccessBlModule], providers: [ProjectsClService], exports: [ProjectsClService] })
export class ProjectsClModule {}
