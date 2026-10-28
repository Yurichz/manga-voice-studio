import { AnalysisBlModule } from '../routes/analysis/layers/analysis-bl/analysis-bl.module.js';
import { ChaptersBlModule } from '../routes/chapters/layers/chapters-bl/chapters-bl.module.js';
import { CharactersBlModule } from '../routes/characters/layers/characters-bl/characters-bl.module.js';
import { DiagnosticsBlModule } from '../routes/diagnostics/layers/diagnostics-bl/diagnostics-bl.module.js';
import { FilesBlModule } from '../routes/files/layers/files-bl/files-bl.module.js';
import { IdentityBlModule } from '../routes/identity/layers/identity-bl/identity-bl.module.js';
import { JobsBlModule } from '../routes/jobs/layers/jobs-bl/jobs-bl.module.js';
import { PagesBlModule } from '../routes/pages/layers/pages-bl/pages-bl.module.js';
import { ProjectsBlModule } from '../routes/projects/layers/projects-bl/projects-bl.module.js';
import { PublicationBlModule } from '../routes/publication/layers/publication-bl/publication-bl.module.js';
import { SpeechBlModule } from '../routes/speech/layers/speech-bl/speech-bl.module.js';
import { VoicesBlModule } from '../routes/voices/layers/voices-bl/voices-bl.module.js';

export const AppBLImports = [
  IdentityBlModule,
  ProjectsBlModule,
  ChaptersBlModule,
  PagesBlModule,
  CharactersBlModule,
  VoicesBlModule,
  AnalysisBlModule,
  SpeechBlModule,
  JobsBlModule,
  PublicationBlModule,
  FilesBlModule,
  DiagnosticsBlModule,
];
