import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { SpeechSnapshotRepository } from './speech-snapshot.repository.js';
import { SpeechRepository } from './speech.repository.js';

@Module({
  imports: [PrismaModule],
  providers: [SpeechSnapshotRepository, SpeechRepository],
  exports: [SpeechSnapshotRepository, SpeechRepository],
})
export class SpeechDaModule {}
