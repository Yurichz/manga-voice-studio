import { AccessBlModule } from '@mvs/backend/access';
import { FilesDaModule } from '@mvs/backend/modules/files-da';
import { Module } from '@nestjs/common';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';

@Module({ imports: [FilesDaModule, AccessBlModule], controllers: [FilesController], providers: [FilesService] })
export class FilesBlModule {}
