import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { CharactersRepository } from './characters.repository.js';

@Module({ imports: [PrismaModule], providers: [CharactersRepository], exports: [CharactersRepository] })
export class CharactersDaModule {}
