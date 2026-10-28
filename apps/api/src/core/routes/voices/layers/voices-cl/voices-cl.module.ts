import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { VoicesDaModule } from '@mvs/backend/modules/voices-da';
import { Module } from '@nestjs/common';
import { VoicesClService } from './voices-cl.service.js';

@Module({ imports: [VoicesDaModule, AccessBlModule, JobEnqueueClModule], providers: [VoicesClService], exports: [VoicesClService] })
export class VoicesClModule {}
