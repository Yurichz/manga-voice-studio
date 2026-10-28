import { Controller, Get, Inject } from '@nestjs/common';
import { OpenApiService } from '../providers/openapi/openapi.service.js';
import { ApiContract } from '../providers/openapi/api-contract.decorator.js';

@Controller()
export class AppController {
  constructor(@Inject(OpenApiService) private readonly openapi: OpenApiService) {}

  @Get('health/live')
  live() {
    return { alive: true };
  }

  @Get('api/v1/openapi')
  @ApiContract({ method: 'get', path: '/openapi', status: 200 })
  document() {
    return this.openapi.document();
  }
}
