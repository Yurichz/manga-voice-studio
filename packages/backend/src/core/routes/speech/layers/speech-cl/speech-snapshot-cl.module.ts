import { Module } from '@nestjs/common';
import { AccessBlModule } from '../../../access/layers/access-bl/access.module.js';
import { SpeechDaModule } from '../speech-da/speech-da.module.js';
import { SpeechSnapshotClService } from './speech-snapshot-cl.service.js';

@Module({ imports: [SpeechDaModule, AccessBlModule], providers: [SpeechSnapshotClService], exports: [SpeechSnapshotClService] })
export class SpeechSnapshotClModule {}
