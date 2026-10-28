import { AiModule } from '@mvs/backend/ai-module';
import { JobProgressBlModule } from '@mvs/backend/jobs';
import { JobsDaModule } from '@mvs/backend/modules/jobs-da';
import { Module } from '@nestjs/common';
import { JOB_HANDLERS } from '../../interfaces/job-context.js';
import { JobsClModule } from '../jobs-cl/jobs-cl.module.js';
import { AnalysisHandler } from './handlers/analysis.handler.js';
import { CharacterSearchHandler } from './handlers/character-search.handler.js';
import { ImportHandler } from './handlers/import.handler.js';
import { PublicationExportHandler } from './handlers/publication-export.handler.js';
import { RenderHandler } from './handlers/render.handler.js';
import { ReplacePageHandler } from './handlers/replace-page.handler.js';
import { SpeechHandler } from './handlers/speech.handler.js';
import { VoiceDesignHandler } from './handlers/voice-design.handler.js';
import { VoiceImportHandler } from './handlers/voice-import.handler.js';
import { JobProcessorService } from './job-processor.service.js';
import { OutboxService } from './outbox.service.js';
import { WorkerRuntimeService } from './worker-runtime.service.js';

@Module({
  imports: [JobsDaModule, JobProgressBlModule, AiModule, JobsClModule],
  providers: [
    JobProcessorService,
    OutboxService,
    WorkerRuntimeService,
    AnalysisHandler,
    CharacterSearchHandler,
    ImportHandler,
    PublicationExportHandler,
    RenderHandler,
    ReplacePageHandler,
    SpeechHandler,
    VoiceDesignHandler,
    VoiceImportHandler,
    {
      provide: JOB_HANDLERS,
      useFactory: (...handlers: unknown[]) => handlers,
      inject: [
        AnalysisHandler,
        CharacterSearchHandler,
        ImportHandler,
        PublicationExportHandler,
        RenderHandler,
        ReplacePageHandler,
        SpeechHandler,
        VoiceDesignHandler,
        VoiceImportHandler,
      ],
    },
  ],
})
export class JobsBlModule {}
