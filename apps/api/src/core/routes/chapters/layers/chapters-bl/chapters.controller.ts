import { uuid } from '@mvs/backend/common';
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { UploadLimitInterceptor, uploadOptions } from '../../../../providers/http/upload-limit.interceptor.js';
import { ZodValidationPipe } from '../../../../providers/http/zod-validation.pipe.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import { createChapterSchema, updateChapterSchema, type CreateChapterDto, type UpdateChapterDto } from '../../dto/chapters.dto.js';
import { ChaptersService } from './chapters.service.js';

@Controller('api/v1')
export class ChaptersController {
  constructor(@Inject(ChaptersService) private readonly service: ChaptersService) {}

  @Post('projects/:projectId/chapters')
  @HttpCode(201)
  @ApiContract({ method: 'post', path: '/projects/:projectId/chapters', status: 201 }, createChapterSchema)
  async createChapter(
    @Owner() ownerId: string,
    @Param('projectId', new ZodValidationPipe(uuid)) projectId: string,
    @Body(new ZodValidationPipe(createChapterSchema)) input: CreateChapterDto,
  ) {
    return this.service.createChapter(ownerId, projectId, input);
  }

  @Get('chapters/:chapterId')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/chapters/:chapterId', status: 200 }, undefined)
  async getChapter(@Owner() ownerId: string, @Param('chapterId', new ZodValidationPipe(uuid)) chapterId: string) {
    return this.service.getChapter(ownerId, chapterId);
  }

  @Patch('chapters/:chapterId')
  @HttpCode(200)
  @ApiContract({ method: 'patch', path: '/chapters/:chapterId', status: 200 }, updateChapterSchema)
  async updateChapter(
    @Owner() ownerId: string,
    @Param('chapterId', new ZodValidationPipe(uuid)) chapterId: string,
    @Body(new ZodValidationPipe(updateChapterSchema)) input: UpdateChapterDto,
  ) {
    return this.service.updateChapter(ownerId, chapterId, input);
  }

  @Post('chapters/:chapterId/import')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/chapters/:chapterId/import', status: 202 }, undefined)
  @UseInterceptors(UploadLimitInterceptor, FilesInterceptor('files', 50, uploadOptions))
  async importChapter(
    @Owner() ownerId: string,
    @Param('chapterId', new ZodValidationPipe(uuid)) chapterId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.service.importChapter(ownerId, chapterId, idempotencyKey, files);
  }
}
