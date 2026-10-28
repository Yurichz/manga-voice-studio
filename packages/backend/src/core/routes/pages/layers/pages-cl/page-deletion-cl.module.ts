import { Module } from '@nestjs/common';
import { PagesDaModule } from '../pages-da/pages-da.module.js';
import { PageDeletionClService } from './page-deletion-cl.service.js';

@Module({ imports: [PagesDaModule], providers: [PageDeletionClService], exports: [PageDeletionClService] })
export class PageDeletionClModule {}
