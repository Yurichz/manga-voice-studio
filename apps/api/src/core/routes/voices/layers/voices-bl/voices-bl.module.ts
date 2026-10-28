import { AccessBlModule } from '@mvs/backend/access';
import { JobEnqueueClModule } from '@mvs/backend/jobs';
import { VoicesDaModule } from '@mvs/backend/modules/voices-da';
import { Module } from '@nestjs/common';
import { VoicesClModule } from '../voices-cl/voices-cl.module.js';
import { VoicesController } from './voices.controller.js';
import { VoicesService } from './voices.service.js';

@Module({
  imports: [VoicesClModule, VoicesDaModule, AccessBlModule, JobEnqueueClModule],
  controllers: [VoicesController],
  providers: [VoicesService],
})
export class VoicesBlModule {}
