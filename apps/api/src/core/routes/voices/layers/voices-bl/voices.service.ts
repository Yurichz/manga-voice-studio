import { AccessService } from '@mvs/backend/access';
import { ApiError, idempotencySchema } from '@mvs/backend/common';
import { JobEnqueueClService } from '@mvs/backend/jobs';
import { speechModel, voxSettings } from '@mvs/contracts';
import { storage } from '@mvs/storage';
import { Inject, Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { type ApplyVoiceDto, type DesignVoiceDto } from '../../dto/voices.dto.js';
import { VoicesClService } from '../voices-cl/voices-cl.service.js';

@Injectable()
export class VoicesService {
  constructor(
    @Inject(VoicesClService)
    private readonly coordinator: VoicesClService,
    @Inject(AccessService)
    private readonly access: AccessService,
    @Inject(JobEnqueueClService)
    private readonly jobs: JobEnqueueClService,
  ) {}

  async applyVoice(ownerId: string, voiceVersionId: string, input: ApplyVoiceDto) {
    return this.coordinator.applyVoice(ownerId, voiceVersionId, input);
  }

  async designVoice(ownerId: string, projectId: string, input: DesignVoiceDto, idempotencyKey: string | undefined) {
    const p = await this.access.project(ownerId, projectId);
    const v = input;
    const j = await this.jobs.job(
      ownerId,
      p.id,
      'voice_design',
      { ...v, language: p.speechLanguage, ...speechModel, generationSettings: { ...voxSettings, seed: randomInt(0, 2147483648) } },
      idempotencySchema.parse(idempotencyKey),
    );

    return { jobId: j.id };
  }

  async importVoice(
    ownerId: string,
    projectId: string,
    idempotencyKey: string | undefined,
    xTranscript: string | undefined,
    xRightsConfirmed: string | undefined,
    xVoiceName: string | undefined,
    file: Express.Multer.File | undefined,
  ) {
    const p = await this.access.project(ownerId, projectId);
    const transcript = z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .parse(xTranscript ? decodeURIComponent(xTranscript!) : undefined);

    if (xRightsConfirmed !== 'true' || !file || file.size > 20 * 1024 * 1024) {
      throw new ApiError(422, 'Confirm your rights and attach a WAV file up to 20 MiB');
    }

    const b = file.buffer;

    if (b.subarray(0, 4).toString() !== 'RIFF' || b.subarray(8, 12).toString() !== 'WAVE') {
      throw new ApiError(422, 'A WAV file is required');
    }

    const key = p.id + '/voices/' + randomUUID() + '.wav';

    await storage.write(key, b);
    const j = await this.jobs.job(
      ownerId,
      p.id,
      'voice_import',
      { referenceKey: key, transcript, name: decodeURIComponent(xVoiceName || 'Voice'), language: p.speechLanguage },
      idempotencySchema.parse(idempotencyKey),
    );

    return { jobId: j.id };
  }

  async saveVoice(
    ownerId: string,
    jobId: string,
    body: {
      profileId?: string;
    },
  ) {
    return this.coordinator.saveVoice(ownerId, jobId, body);
  }
}
