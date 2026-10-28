import { Injectable } from '@nestjs/common';
import type { JobContext, JobHandler } from '../../../interfaces/job-context.js';

@Injectable()
export class VoiceImportHandler implements JobHandler {
  readonly kinds = ['voice_import'];

  constructor() {}

  async handle({ job: j, input: v, runAI }: JobContext) {
    const result = await runAI('voice_import', { ...v, projectId: j.projectId });

    return { result };
  }
}
