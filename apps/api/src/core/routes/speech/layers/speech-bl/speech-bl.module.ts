import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { SpeechDaModule } from '@mvs/backend/modules/speech-da';
import { SpeechSnapshotClModule } from '@mvs/backend/speech';
import { Module } from '@nestjs/common';
import { SpeechClModule } from '../speech-cl/speech-cl.module.js';
import { SpeechController } from './speech.controller.js';
import { SpeechService } from './speech.service.js';

@Module({
  imports: [SpeechClModule, SpeechDaModule, AccessBlModule, JobEnqueueClModule, SpeechSnapshotClModule],
  controllers: [SpeechController],
  providers: [SpeechService],
})
export class SpeechBlModule {}
