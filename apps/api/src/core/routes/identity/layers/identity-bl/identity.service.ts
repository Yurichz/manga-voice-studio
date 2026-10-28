import { Injectable } from '@nestjs/common';

@Injectable()
export class IdentityService {
  constructor() {}

  async me(ownerId: string) {
    return { ownerId: ownerId, demo: process.env.DEMO_MODE === 'true' };
  }
}
