import { analysisSchema } from '@mvs/contracts';
import { Injectable } from '@nestjs/common';
import type { JobContext, JobHandler } from '../../../interfaces/job-context.js';

@Injectable()
export class AnalysisHandler implements JobHandler {
  readonly kinds = ['analysis'];

  constructor() {}

  async handle({ input: v, project: p, runAI }: JobContext) {
    const result = await runAI('vision', { ...v, readingDirection: v.readingDirection || p.readingDirection });

    result.proposal = analysisSchema.parse(result.proposal);

    return { result };
  }
}
