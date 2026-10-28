import { uuid } from '@mvs/backend/common';
import { Body, Controller, Headers, HttpCode, Inject, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { UploadLimitInterceptor, uploadOptions } from '../../../../providers/http/upload-limit.interceptor.js';
import { ZodValidationPipe } from '../../../../providers/http/zod-validation.pipe.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import {
  applyVoiceSchema,
  designVoiceSchema,
  saveVoiceSchema,
  type ApplyVoiceDto,
  type DesignVoiceDto,
  type SaveVoiceDto,
} from '../../dto/voices.dto.js';
import { VoicesService } from './voices.service.js';

@Controller('api/v1')
export class VoicesController {
  constructor(@Inject(VoicesService) private readonly service: VoicesService) {}

  @Post('voices/:voiceVersionId/apply')
  @HttpCode(200)
  @ApiContract({ method: 'post', path: '/voices/:voiceVersionId/apply', status: 200 }, applyVoiceSchema)
  async applyVoice(
    @Owner() ownerId: string,
    @Param('voiceVersionId', new ZodValidationPipe(uuid)) voiceVersionId: string,
    @Body(new ZodValidationPipe(applyVoiceSchema)) input: ApplyVoiceDto,
  ) {
    return this.service.applyVoice(ownerId, voiceVersionId, input);
  }

  @Post('projects/:projectId/voices/design')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/projects/:projectId/voices/design', status: 202 }, designVoiceSchema)
  async designVoice(
    @Owner() ownerId: string,
    @Param('projectId', new ZodValidationPipe(uuid)) projectId: string,
    @Body(new ZodValidationPipe(designVoiceSchema)) input: DesignVoiceDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.service.designVoice(ownerId, projectId, input, idempotencyKey);
  }

  @Post('projects/:projectId/voices/import')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/projects/:projectId/voices/import', status: 202 }, undefined)
  @UseInterceptors(UploadLimitInterceptor, FileInterceptor('file', uploadOptions))
  async importVoice(
    @Owner() ownerId: string,
    @Param('projectId', new ZodValidationPipe(uuid)) projectId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('X-Transcript') xTranscript: string | undefined,
    @Headers('X-Rights-Confirmed') xRightsConfirmed: string | undefined,
    @Headers('X-Voice-Name') xVoiceName: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.service.importVoice(ownerId, projectId, idempotencyKey, xTranscript, xRightsConfirmed, xVoiceName, file);
  }

  @Post('jobs/:jobId/save-voice')
  @HttpCode(201)
  @ApiContract({ method: 'post', path: '/jobs/:jobId/save-voice', status: 201 }, saveVoiceSchema)
  async saveVoice(
    @Owner() ownerId: string,
    @Param('jobId', new ZodValidationPipe(uuid)) jobId: string,
    @Body(new ZodValidationPipe(saveVoiceSchema)) input: SaveVoiceDto,
  ) {
    return this.service.saveVoice(ownerId, jobId, input);
  }
}
