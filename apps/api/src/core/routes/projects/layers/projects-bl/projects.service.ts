import { AccessService } from '@mvs/backend/access';
import { ProjectsRepository } from '@mvs/backend/repositories/projects';
import { Inject, Injectable } from '@nestjs/common';
import { type CreateProjectDto, type UpdateProjectDto } from '../../dto/projects.dto.js';
import { ProjectsClService } from '../projects-cl/projects-cl.service.js';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(ProjectsClService)
    private readonly coordinator: ProjectsClService,
    @Inject(ProjectsRepository)
    private readonly repository: ProjectsRepository,
    @Inject(AccessService)
    private readonly access: AccessService,
  ) {}

  async listProjects(ownerId: string) {
    return await this.repository.listProjectsProjectFindMany(ownerId);
  }

  async createProject(ownerId: string, input: CreateProjectDto) {
    return await this.repository.createProjectProjectCreate(input, ownerId);
  }

  async getProject(ownerId: string, projectId: string) {
    const p = await this.access.project(ownerId, projectId);

    return {
      ...p,
      chapters: await this.repository.getProjectChapterFindMany(p.id),
      characters: await this.repository.getProjectCharacterFindMany(p.id),
      voices: await this.repository.getProjectVoiceProfileFindMany(p.id),
    };
  }

  async updateProject(ownerId: string, projectId: string, input: UpdateProjectDto) {
    return this.coordinator.updateProject(ownerId, projectId, input);
  }

  async deleteProject(ownerId: string, projectId: string) {
    return this.coordinator.deleteProject(ownerId, projectId);
  }
}
