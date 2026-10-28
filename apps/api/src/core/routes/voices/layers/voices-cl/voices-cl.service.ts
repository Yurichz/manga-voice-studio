import { AccessService } from '@mvs/backend/access';
import { ApiError, json, uuid } from '@mvs/backend/common';
import { PrismaService } from '@mvs/backend/prisma';
import { VoicesRepository } from '@mvs/backend/repositories/voices';
import { Inject, Injectable } from '@nestjs/common';
import { type ApplyVoiceDto } from '../../dto/voices.dto.js';

@Injectable()
export class VoicesClService {
  constructor(
    @Inject(VoicesRepository)
    private readonly repository: VoicesRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AccessService)
    private readonly access: AccessService,
  ) {}

  async applyVoice(ownerId: string, voiceVersionId: string, input: ApplyVoiceDto) {
    const voice = await this.repository.applyVoiceVoiceProfileVersionFindUnique(voiceVersionId);

    if (!voice) {
      throw new ApiError(404, 'Voice not found');
    }

    await this.access.project(ownerId, voice.projectId);
    const v = input;

    await this.prisma.$txe(async (tx) => {
      for (const u of v.utterances) {
        const n = await this.repository.tx(tx).applyVoiceUtteranceUpdateMany(u.id, voice.projectId, u.expectedRevision, voice.id);

        if (!n.count) {
          throw new ApiError(409, 'The utterance changed');
        }
      }

      await this.repository.tx(tx).applyVoicePageUpdateMany(
        voice.projectId,
        v.utterances.map((u) => u.id),
      );
      await this.repository.tx(tx).applyVoiceChapterUpdateMany(voice.projectId);
    });

    return { updated: v.utterances.length };
  }

  async saveVoice(
    ownerId: string,
    jobId: string,
    body: {
      profileId?: string;
    },
  ) {
    const j = await this.repository.saveVoiceJobFindUnique(jobId);

    if (!j || j.ownerId !== ownerId) {
      throw new ApiError(404, 'Job not found');
    }

    await this.access.project(j.ownerId, j.projectId);
    if (j.kind !== 'voice_design' || j.status !== 'succeeded' || !j.result) {
      throw new ApiError(422, 'No completed voice is available');
    }

    const input = j.input as any,
      result = j.result as any;
    const profileId = uuid.optional().parse(body.profileId);

    if (profileId && !(await this.repository.saveVoiceVoiceProfileFindFirst(profileId, j.projectId))) {
      throw new ApiError(404, 'Profile not found');
    }

    const v = await this.prisma.$txe(async (tx) => {
      const profile = profileId ? { id: profileId } : await this.repository.tx(tx).saveVoiceVoiceProfileCreate(j.projectId, input.name);

      return this.repository.tx(tx).saveVoiceVoiceProfileVersionCreate(
        j.projectId,
        profile.id,
        result.fileKey,
        input.transcript,
        input.language,
        result.checksum,
        result.modelRevision,
        json({
          description: input.description,
          modelId: result.modelId,
          adapterVersion: result.adapterVersion,
          ...(result.effectiveInstruction
            ? {
              effectiveInstruction: result.effectiveInstruction,
              promptModelRevision: result.promptModelRevision,
              promptVersion: result.promptVersion,
              generationSettings: result.generationSettings,
            }
            : {}),
        }),
      );
    });

    return v;
  }
}
