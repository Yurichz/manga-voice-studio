import { uuid } from '@mvs/backend/common';
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { ZodValidationPipe } from '../../../../providers/http/zod-validation.pipe.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import { JobsService } from './jobs.service.js';

@Controller('api/v1')
export class JobsController {
  constructor(@Inject(JobsService) private readonly service: JobsService) {}

  @Get('projects/:projectId/job-progress')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/projects/:projectId/job-progress', status: 200 }, undefined)
  async jobProgress(@Owner() ownerId: string, @Param('projectId', new ZodValidationPipe(uuid)) projectId: string) {
    return this.service.jobProgress(ownerId, projectId);
  }

  @Get('projects/:projectId/jobs')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/projects/:projectId/jobs', status: 200 }, undefined)
  async listJobs(@Owner() ownerId: string, @Param('projectId', new ZodValidationPipe(uuid)) projectId: string) {
    return this.service.listJobs(ownerId, projectId);
  }

  @Get('jobs/:jobId')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/jobs/:jobId', status: 200 }, undefined)
  async getJob(@Owner() ownerId: string, @Param('jobId', new ZodValidationPipe(uuid)) jobId: string) {
    return this.service.getJob(ownerId, jobId);
  }

  @Post('jobs/:jobId/cancel')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/jobs/:jobId/cancel', status: 202 }, undefined)
  async cancelJob(@Owner() ownerId: string, @Param('jobId', new ZodValidationPipe(uuid)) jobId: string) {
    return this.service.cancelJob(ownerId, jobId);
  }

  @Post('jobs/:jobId/retry')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/jobs/:jobId/retry', status: 202 }, undefined)
  async retryJob(
    @Owner() ownerId: string,
    @Param('jobId', new ZodValidationPipe(uuid)) jobId: string,
    @Body() input: any,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.service.retryJob(ownerId, jobId, input, idempotencyKey);
  }
}
