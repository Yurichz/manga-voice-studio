import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { ChaptersRepository } from './chapters.repository.js';

@Module({ imports: [PrismaModule], providers: [ChaptersRepository], exports: [ChaptersRepository] })
export class ChaptersDaModule {}
