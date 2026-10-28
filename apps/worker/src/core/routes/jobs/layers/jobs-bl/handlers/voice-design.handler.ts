import { Injectable } from '@nestjs/common';
import type { JobContext, JobHandler } from '../../../interfaces/job-context.js';

@Injectable()
export class VoiceDesignHandler implements JobHandler {
  readonly kinds = ['voice_design'];

  constructor() {}

  async handle({ job: j, input: v, phase, runAI }: JobContext) {
    await phase('loading_prompt');
    const prepared = await runAI('voice_prompt', { description: v.description });

    await phase('loading_model');
    const result = { ...(await runAI('design', { ...v, ...prepared, projectId: j.projectId })), ...prepared };

    return { result };
  }
}
