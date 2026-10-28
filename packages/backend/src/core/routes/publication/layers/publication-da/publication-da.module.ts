import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { PublicationRepository } from './publication.repository.js';

@Module({ imports: [PrismaModule], providers: [PublicationRepository], exports: [PublicationRepository] })
export class PublicationDaModule {}
