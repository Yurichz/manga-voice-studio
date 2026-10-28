import { Module } from '@nestjs/common';
import { AiModule } from '../providers/ai/ai.module.js';
import { AuthModule } from '../providers/auth/auth.module.js';
import { PrismaModule } from '../providers/prisma/prisma.module.js';
import { AccessBlModule } from '../routes/access/layers/access-bl/access.module.js';
import { JobProgressBlModule } from '../routes/jobs/layers/jobs-bl/job-progress.module.js';
import { JobEnqueueClModule } from '../routes/jobs/layers/jobs-cl/job-enqueue-cl.module.js';
import { PageDeletionClModule } from '../routes/pages/layers/pages-cl/page-deletion-cl.module.js';
import { PublicationClModule } from '../routes/publication/layers/publication-cl/publication-cl.module.js';
import { SpeechSnapshotClModule } from '../routes/speech/layers/speech-cl/speech-snapshot-cl.module.js';

@Module({
  imports: [
    AccessBlModule,
    JobEnqueueClModule,
    JobProgressBlModule,
    PageDeletionClModule,
    SpeechSnapshotClModule,
    PublicationClModule,
    PrismaModule,
    AiModule,
    AuthModule,
  ],
  exports: [
    AccessBlModule,
    JobEnqueueClModule,
    JobProgressBlModule,
    PageDeletionClModule,
    SpeechSnapshotClModule,
    PublicationClModule,
    PrismaModule,
    AiModule,
    AuthModule,
  ],
})
export class BackendModule {}
