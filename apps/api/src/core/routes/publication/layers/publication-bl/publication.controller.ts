import { uuid } from '@mvs/backend/common';
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { ZodValidationPipe } from '../../../../providers/http/zod-validation.pipe.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import { exportPublicationSchema, type ExportPublicationDto } from '../../dto/publication.dto.js';
import { PublicationService } from './publication.service.js';

@Controller('api/v1')
export class PublicationController {
  constructor(@Inject(PublicationService) private readonly service: PublicationService) {}

  @Get('projects/:projectId/publication-preview')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/projects/:projectId/publication-preview', status: 200 }, undefined)
  async previewPublication(@Owner() ownerId: string, @Param('projectId', new ZodValidationPipe(uuid)) projectId: string) {
    return this.service.previewPublication(ownerId, projectId);
  }

  @Post('projects/:projectId/publication-export')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/projects/:projectId/publication-export', status: 202 }, exportPublicationSchema)
  async exportPublication(
    @Owner() ownerId: string,
    @Param('projectId', new ZodValidationPipe(uuid)) projectId: string,
    @Body(new ZodValidationPipe(exportPublicationSchema)) input: ExportPublicationDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.service.exportPublication(ownerId, projectId, input, idempotencyKey);
  }
}
