import { Module } from '@nestjs/common';
import { AccessDaModule } from '../access-da/access-da.module.js';
import { AccessService } from './access.service.js';

@Module({ imports: [AccessDaModule], providers: [AccessService], exports: [AccessService] })
export class AccessBlModule {}
