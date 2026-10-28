import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { FilesRepository } from './files.repository.js';

@Module({ imports: [PrismaModule], providers: [FilesRepository], exports: [FilesRepository] })
export class FilesDaModule {}
