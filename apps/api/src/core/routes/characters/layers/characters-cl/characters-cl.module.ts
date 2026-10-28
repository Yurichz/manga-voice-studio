import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { CharactersDaModule } from '@mvs/backend/modules/characters-da';
import { Module } from '@nestjs/common';
import { CharactersClService } from './characters-cl.service.js';

@Module({
  imports: [CharactersDaModule, AccessBlModule, JobEnqueueClModule],
  providers: [CharactersClService],
  exports: [CharactersClService],
})
export class CharactersClModule {}
