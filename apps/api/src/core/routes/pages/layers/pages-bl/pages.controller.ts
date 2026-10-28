import { uuid } from '@mvs/backend/common';
import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { UploadLimitInterceptor, uploadOptions } from '../../../../providers/http/upload-limit.interceptor.js';
import { ZodValidationPipe } from '../../../../providers/http/zod-validation.pipe.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import {
  deleteChapterPagesSchema,
  deletePageSchema,
  updatePageSchema,
  type DeleteChapterPagesDto,
  type DeletePageDto,
  type UpdatePageDto,
} from '../../dto/pages.dto.js';
import { PagesService } from './pages.service.js';

@Controller('api/v1')
export class PagesController {
  constructor(@Inject(PagesService) private readonly service: PagesService) {}

  @Post('pages/:pageId/replace')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/pages/:pageId/replace', status: 202 }, undefined)
  @UseInterceptors(UploadLimitInterceptor, FileInterceptor('file', uploadOptions))
  async replacePage(
    @Owner() ownerId: string,
    @Param('pageId', new ZodValidationPipe(uuid)) pageId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('X-Confirm-Replace') xConfirmReplace: string | undefined,
    @Headers('X-Expected-Revision') xExpectedRevision: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.service.replacePage(ownerId, pageId, idempotencyKey, xConfirmReplace, xExpectedRevision, file);
  }

  @Get('pages/:pageId')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/pages/:pageId', status: 200 }, undefined)
  async getPage(@Owner() ownerId: string, @Param('pageId', new ZodValidationPipe(uuid)) pageId: string) {
    return this.service.getPage(ownerId, pageId);
  }

  @Put('pages/:pageId')
  @HttpCode(200)
  @ApiContract({ method: 'put', path: '/pages/:pageId', status: 200 }, updatePageSchema)
  async updatePage(
    @Owner() ownerId: string,
    @Param('pageId', new ZodValidationPipe(uuid)) pageId: string,
    @Body(new ZodValidationPipe(updatePageSchema)) input: UpdatePageDto,
  ) {
    return this.service.updatePage(ownerId, pageId, input);
  }

  @Delete('pages/:pageId')
  @HttpCode(200)
  @ApiContract({ method: 'delete', path: '/pages/:pageId', status: 200 }, deletePageSchema)
  async deletePage(
    @Owner() ownerId: string,
    @Param('pageId', new ZodValidationPipe(uuid)) pageId: string,
    @Body(new ZodValidationPipe(deletePageSchema)) input: DeletePageDto,
  ) {
    return this.service.deletePage(ownerId, pageId, input);
  }

  @Delete('chapters/:chapterId/pages')
  @HttpCode(200)
  @ApiContract({ method: 'delete', path: '/chapters/:chapterId/pages', status: 200 }, deleteChapterPagesSchema)
  async deleteChapterPages(
    @Owner() ownerId: string,
    @Param('chapterId', new ZodValidationPipe(uuid)) chapterId: string,
    @Body(new ZodValidationPipe(deleteChapterPagesSchema)) input: DeleteChapterPagesDto,
  ) {
    return this.service.deleteChapterPages(ownerId, chapterId, input);
  }
}
