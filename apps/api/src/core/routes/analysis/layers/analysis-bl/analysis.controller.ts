import { uuid } from '@mvs/backend/common';
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { ZodValidationPipe } from '../../../../providers/http/zod-validation.pipe.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import { applyAnalysisSchema, findCandidatesSchema, type ApplyAnalysisDto, type FindCandidatesDto } from '../../dto/analysis.dto.js';
import { AnalysisService } from './analysis.service.js';

@Controller('api/v1')
export class AnalysisController {
  constructor(@Inject(AnalysisService) private readonly service: AnalysisService) {}

  @Post('pages/:pageId/candidates')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/pages/:pageId/candidates', status: 202 }, findCandidatesSchema)
  async findCandidates(
    @Owner() ownerId: string,
    @Param('pageId', new ZodValidationPipe(uuid)) pageId: string,
    @Body(new ZodValidationPipe(findCandidatesSchema)) input: FindCandidatesDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.service.findCandidates(ownerId, pageId, input, idempotencyKey);
  }

  @Post('pages/:pageId/analysis')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/pages/:pageId/analysis', status: 202 }, undefined)
  async analysePage(
    @Owner() ownerId: string,
    @Param('pageId', new ZodValidationPipe(uuid)) pageId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.service.analysePage(ownerId, pageId, idempotencyKey);
  }

  @Get('pages/:pageId/analyses')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/pages/:pageId/analyses', status: 200 }, undefined)
  async listAnalyses(@Owner() ownerId: string, @Param('pageId', new ZodValidationPipe(uuid)) pageId: string) {
    return this.service.listAnalyses(ownerId, pageId);
  }

  @Post('analyses/:analysisId/apply')
  @HttpCode(200)
  @ApiContract({ method: 'post', path: '/analyses/:analysisId/apply', status: 200 }, applyAnalysisSchema)
  async applyAnalysis(
    @Owner() ownerId: string,
    @Param('analysisId', new ZodValidationPipe(uuid)) analysisId: string,
    @Body(new ZodValidationPipe(applyAnalysisSchema)) input: ApplyAnalysisDto,
  ) {
    return this.service.applyAnalysis(ownerId, analysisId, input);
  }
}
