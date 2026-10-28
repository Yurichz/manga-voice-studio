import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { SpeechDaModule } from '@mvs/backend/modules/speech-da';
import { SpeechSnapshotClModule } from '@mvs/backend/speech';
import { Module } from '@nestjs/common';
import { SpeechClService } from './speech-cl.service.js';

@Module({
  imports: [SpeechDaModule, AccessBlModule, JobEnqueueClModule, SpeechSnapshotClModule],
  providers: [SpeechClService],
  exports: [SpeechClService],
})
export class SpeechClModule {}
