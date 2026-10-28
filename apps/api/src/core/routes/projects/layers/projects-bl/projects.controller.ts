import { uuid } from '@mvs/backend/common';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { ZodValidationPipe } from '../../../../providers/http/zod-validation.pipe.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import { createProjectSchema, updateProjectSchema, type CreateProjectDto, type UpdateProjectDto } from '../../dto/projects.dto.js';
import { ProjectsService } from './projects.service.js';

@Controller('api/v1')
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly service: ProjectsService) {}

  @Get('projects')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/projects', status: 200 }, undefined)
  async listProjects(@Owner() ownerId: string) {
    return this.service.listProjects(ownerId);
  }

  @Post('projects')
  @HttpCode(201)
  @ApiContract({ method: 'post', path: '/projects', status: 201 }, createProjectSchema)
  async createProject(@Owner() ownerId: string, @Body(new ZodValidationPipe(createProjectSchema)) input: CreateProjectDto) {
    return this.service.createProject(ownerId, input);
  }

  @Get('projects/:projectId')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/projects/:projectId', status: 200 }, undefined)
  async getProject(@Owner() ownerId: string, @Param('projectId', new ZodValidationPipe(uuid)) projectId: string) {
    return this.service.getProject(ownerId, projectId);
  }

  @Patch('projects/:projectId')
  @HttpCode(200)
  @ApiContract({ method: 'patch', path: '/projects/:projectId', status: 200 }, updateProjectSchema)
  async updateProject(
    @Owner() ownerId: string,
    @Param('projectId', new ZodValidationPipe(uuid)) projectId: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) input: UpdateProjectDto,
  ) {
    return this.service.updateProject(ownerId, projectId, input);
  }

  @Delete('projects/:projectId')
  @HttpCode(202)
  @ApiContract({ method: 'delete', path: '/projects/:projectId', status: 202 }, undefined)
  async deleteProject(@Owner() ownerId: string, @Param('projectId', new ZodValidationPipe(uuid)) projectId: string) {
    return this.service.deleteProject(ownerId, projectId);
  }
}
