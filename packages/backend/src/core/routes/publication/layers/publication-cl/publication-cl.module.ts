import { Module } from '@nestjs/common';
import { PublicationDaModule } from '../publication-da/publication-da.module.js';
import { PublicationClService } from './publication-cl.service.js';

@Module({ imports: [PublicationDaModule], providers: [PublicationClService], exports: [PublicationClService] })
export class PublicationClModule {}
