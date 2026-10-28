import { uuid } from '@mvs/backend/common';
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { ZodValidationPipe } from '../../../../providers/http/zod-validation.pipe.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import {
  selectAudioSchema,
  speechChapterSchema,
  speechUtteranceSchema,
  type SelectAudioDto,
  type SpeechChapterDto,
  type SpeechUtteranceDto,
} from '../../dto/speech.dto.js';
import { SpeechService } from './speech.service.js';

@Controller('api/v1')
export class SpeechController {
  constructor(@Inject(SpeechService) private readonly service: SpeechService) {}

  @Get('utterances/:utteranceId/pronunciation')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/utterances/:utteranceId/pronunciation', status: 200 }, undefined)
  async pronunciation(@Owner() ownerId: string, @Param('utteranceId', new ZodValidationPipe(uuid)) utteranceId: string) {
    return this.service.pronunciation(ownerId, utteranceId);
  }

  @Post('utterances/:utteranceId/speech')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/utterances/:utteranceId/speech', status: 202 }, speechUtteranceSchema)
  async speechUtterance(
    @Owner() ownerId: string,
    @Param('utteranceId', new ZodValidationPipe(uuid)) utteranceId: string,
    @Body(new ZodValidationPipe(speechUtteranceSchema)) input: SpeechUtteranceDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.service.speechUtterance(ownerId, utteranceId, input, idempotencyKey);
  }

  @Post('utterances/:utteranceId/audio')
  @HttpCode(200)
  @ApiContract({ method: 'post', path: '/utterances/:utteranceId/audio', status: 200 }, selectAudioSchema)
  async selectAudio(
    @Owner() ownerId: string,
    @Param('utteranceId', new ZodValidationPipe(uuid)) utteranceId: string,
    @Body(new ZodValidationPipe(selectAudioSchema)) input: SelectAudioDto,
  ) {
    return this.service.selectAudio(ownerId, utteranceId, input);
  }

  @Post('chapters/:chapterId/speech')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/chapters/:chapterId/speech', status: 202 }, speechChapterSchema)
  async speechChapter(
    @Owner() ownerId: string,
    @Param('chapterId', new ZodValidationPipe(uuid)) chapterId: string,
    @Body(new ZodValidationPipe(speechChapterSchema)) input: SpeechChapterDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.service.speechChapter(ownerId, chapterId, input, idempotencyKey);
  }

  @Post('chapters/:chapterId/speech/cancel')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/chapters/:chapterId/speech/cancel', status: 202 }, undefined)
  async cancelChapterSpeech(
    @Owner() ownerId: string,
    @Param('chapterId', new ZodValidationPipe(uuid)) chapterId: string,
  ) {
    return this.service.cancelChapterSpeech(ownerId, chapterId);
  }

  @Get('projects/:projectId/artifacts')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/projects/:projectId/artifacts', status: 200 }, undefined)
  async listArtifacts(@Owner() ownerId: string, @Param('projectId', new ZodValidationPipe(uuid)) projectId: string) {
    return this.service.listArtifacts(ownerId, projectId);
  }

  @Post('chapters/:chapterId/render')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/chapters/:chapterId/render', status: 202 }, undefined)
  async renderChapter(
    @Owner() ownerId: string,
    @Param('chapterId', new ZodValidationPipe(uuid)) chapterId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.service.renderChapter(ownerId, chapterId, idempotencyKey);
  }
}
