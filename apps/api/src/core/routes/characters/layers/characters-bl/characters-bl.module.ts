import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { CharactersDaModule } from '@mvs/backend/modules/characters-da';
import { Module } from '@nestjs/common';
import { CharactersClModule } from '../characters-cl/characters-cl.module.js';
import { CharactersController } from './characters.controller.js';
import { CharactersService } from './characters.service.js';

@Module({
  imports: [CharactersClModule, CharactersDaModule, AccessBlModule, JobEnqueueClModule],
  controllers: [CharactersController],
  providers: [CharactersService],
})
export class CharactersBlModule {}
