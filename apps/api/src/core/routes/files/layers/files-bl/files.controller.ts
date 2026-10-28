import { uuid } from '@mvs/backend/common';
import { Controller, Get, HttpCode, Inject, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { ZodValidationPipe } from '../../../../providers/http/zod-validation.pipe.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import { FilesService } from './files.service.js';

@Controller('api/v1')
export class FilesController {
  constructor(@Inject(FilesService) private readonly service: FilesService) {}

  @Get('files/:projectId/*key')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/files/:projectId/*key', status: 200 }, undefined)
  async downloadFile(
    @Owner() ownerId: string,
    @Param('projectId', new ZodValidationPipe(uuid)) projectId: string,
    @Param('key') fileSuffix: string | string[],
    @Res() response: Response,
  ) {
    const file = await this.service.downloadFile(ownerId, projectId, fileSuffix);

    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    await new Promise<void>((resolve, reject) => response.sendFile(file, (error) => (error ? reject(error) : resolve())));
  }
}
