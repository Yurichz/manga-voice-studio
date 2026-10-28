import { Controller, Get, HttpCode, Inject } from '@nestjs/common';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import { DiagnosticsService } from './diagnostics.service.js';

@Controller('api/v1')
export class DiagnosticsController {
  constructor(@Inject(DiagnosticsService) private readonly service: DiagnosticsService) {}

  @Get('health')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/health', status: 200 }, undefined)
  async health(@Owner() ownerId: string) {
    return this.service.health(ownerId);
  }
}
