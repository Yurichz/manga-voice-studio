import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { PageDeletionRepository } from './page-deletion.repository.js';
import { PagesRepository } from './pages.repository.js';

@Module({
  imports: [PrismaModule],
  providers: [PageDeletionRepository, PagesRepository],
  exports: [PageDeletionRepository, PagesRepository],
})
export class PagesDaModule {}
