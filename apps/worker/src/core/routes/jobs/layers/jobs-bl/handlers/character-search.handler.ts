import { CharacterSearchRepository } from '@mvs/backend/repositories/character-search';
import { Inject, Injectable } from '@nestjs/common';
import type { JobContext, JobHandler } from '../../../interfaces/job-context.js';

@Injectable()
export class CharacterSearchHandler implements JobHandler {
  readonly kinds = ['embedding', 'candidates'];

  constructor(
    @Inject(CharacterSearchRepository)
    private readonly repository: CharacterSearchRepository,
  ) {}

  async handle({ job: j, input: v, phase, runAI }: JobContext) {
    const result = await runAI('embedding', v);

    if (j.kind === 'candidates') {
      await phase('searching');
      const vector = '[' + result.embedding.join(',') + ']';

      result.candidates = await this.repository.handleSqlQueryRaw(vector, vector, j.projectId, j.ownerId, result.encoderRevision, vector);
      delete result.embedding;
    }

    return { result };
  }
}
