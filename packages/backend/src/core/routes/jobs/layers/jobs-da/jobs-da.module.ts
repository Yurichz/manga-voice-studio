import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { CharacterSearchRepository } from './character-search.repository.js';
import { ImportRepository } from './import.repository.js';
import { JobEnqueueRepository } from './job-enqueue.repository.js';
import { JobProcessorRepository } from './job-processor.repository.js';
import { JobProgressRepository } from './job-progress.repository.js';
import { JobPublicationRepository } from './job-publication.repository.js';
import { JobsRepository } from './jobs.repository.js';
import { OutboxRepository } from './outbox.repository.js';
import { PublicationExportRepository } from './publication-export.repository.js';
import { RenderSnapshotRepository } from './render-snapshot.repository.js';
import { SpeechSynthesisRepository } from './speech.repository.js';
import { WorkerRuntimeRepository } from './worker-runtime.repository.js';

@Module({
  imports: [PrismaModule],
  providers: [
    JobEnqueueRepository,
    JobProgressRepository,
    JobsRepository,
    JobPublicationRepository,
    JobProcessorRepository,
    OutboxRepository,
    WorkerRuntimeRepository,
    RenderSnapshotRepository,
    CharacterSearchRepository,
    ImportRepository,
    PublicationExportRepository,
    SpeechSynthesisRepository,
  ],
  exports: [
    JobEnqueueRepository,
    JobProgressRepository,
    JobsRepository,
    JobPublicationRepository,
    JobProcessorRepository,
    OutboxRepository,
    WorkerRuntimeRepository,
    RenderSnapshotRepository,
    CharacterSearchRepository,
    ImportRepository,
    PublicationExportRepository,
    SpeechSynthesisRepository,
  ],
})
export class JobsDaModule {}
