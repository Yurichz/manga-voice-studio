import { SpeechSynthesisRepository } from '@mvs/backend/repositories/speech-synthesis';
import { inputHash } from '@mvs/contracts/server';
import { Inject, Injectable } from '@nestjs/common';
import type { JobContext, JobHandler } from '../../../interfaces/job-context.js';

@Injectable()
export class SpeechHandler implements JobHandler {
  readonly kinds = ['speech'];

  constructor(
    @Inject(SpeechSynthesisRepository)
    private readonly repository: SpeechSynthesisRepository,
  ) {}

  async handle({ job: j, input: v, runAI }: JobContext) {
    let result: any;
    let extra: any;
    const hash = inputHash(v.canonical);
    const cached = await this.repository.handleAudioArtifactFindUnique(j.projectId, hash);

    if (cached) {
      result = {
        artifactId: cached.id,
        fileKey: cached.fileKey,
        modelId: v.canonical.modelId || 'Qwen/Qwen3-TTS-12Hz-1.7B-Base',
        modelRevision: cached.modelRevision,
        adapterVersion: v.canonical.adapterVersion,
        generationSettings: v.canonical.settings,
        cloningMode: v.canonical.cloningMode,
        synthesisText: v.canonical.synthesisText,
        textPreparationVersion: v.canonical.textPreparationVersion,
        cached: true,
      };
    } else {
      extra = await runAI('speech', { ...v, projectId: j.projectId });
      result = { ...extra, inputHash: hash };
    }

    return { result, extra };
  }
}
