import { Controller, Get, HttpCode, Inject } from '@nestjs/common';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import { IdentityService } from './identity.service.js';

@Controller('api/v1')
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly service: IdentityService) {}

  @Get('me')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/me', status: 200 }, undefined)
  async me(@Owner() ownerId: string) {
    return this.service.me(ownerId);
  }
}
