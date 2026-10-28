import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { AccessRepository } from './access.repository.js';

@Module({ imports: [PrismaModule], providers: [AccessRepository], exports: [AccessRepository] })
export class AccessDaModule {}
