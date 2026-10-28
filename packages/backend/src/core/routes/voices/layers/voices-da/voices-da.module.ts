import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { VoicesRepository } from './voices.repository.js';

@Module({ imports: [PrismaModule], providers: [VoicesRepository], exports: [VoicesRepository] })
export class VoicesDaModule {}
