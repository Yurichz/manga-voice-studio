import { AccessService } from '@mvs/backend/access';
import { ApiError } from '@mvs/backend/common';
import { PrismaService } from '@mvs/backend/prisma';
import { ProjectsRepository } from '@mvs/backend/repositories/projects';
import { Inject, Injectable } from '@nestjs/common';
import { type UpdateProjectDto } from '../../dto/projects.dto.js';

@Injectable()
export class ProjectsClService {
  constructor(
    @Inject(ProjectsRepository)
    private readonly repository: ProjectsRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AccessService)
    private readonly access: AccessService,
  ) {}

  async updateProject(ownerId: string, projectId: string, input: UpdateProjectDto) {
    const p = await this.access.project(ownerId, projectId);
    const v = input;
    const { expectedRevision, ...data } = v;

    await this.prisma.$txe(async (tx) => {
      const n = await this.repository.tx(tx).updateProjectProjectUpdateMany(p.id, expectedRevision, data);

      if (!n.count) {
        throw new ApiError(409, 'The project revision changed');
      }

      if (data.speechLanguage !== undefined && data.speechLanguage !== p.speechLanguage) {
        await this.repository.tx(tx).updateProjectUtteranceUpdateMany(p.id);
        await this.repository.tx(tx).updateProjectPageUpdateMany(p.id);
        await this.repository.tx(tx).updateProjectChapterUpdateMany(p.id);
      }
    });

    return await this.repository.updateProjectProjectFindUnique(p.id);
  }

  async deleteProject(ownerId: string, projectId: string) {
    const p = await this.access.project(ownerId, projectId);

    await this.prisma.$txe(async () => {
      await this.repository.deleteProjectProjectUpdate(p.id, new Date());
      await this.repository.deleteProjectJobUpdateMany(p.id);
    });

    return { deleted: true };
  }
}
