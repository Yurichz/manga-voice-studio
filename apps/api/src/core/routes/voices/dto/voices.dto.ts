import { revision, title, uuid } from '@mvs/backend/common';
import { z } from 'zod';

export const applyVoiceSchema = z.object({
  utterances: z.array(z.object({ id: uuid, expectedRevision: revision })).max(500),
  confirm: z.literal(true),
});
export type ApplyVoiceDto = z.output<typeof applyVoiceSchema>;
export const designVoiceSchema = z.object({
  name: title,
  description: z.string().trim().min(1).max(2000),
  transcript: z.string().trim().min(1).max(1000),
});
export type DesignVoiceDto = z.output<typeof designVoiceSchema>;

export const saveVoiceSchema = z.object({ profileId: uuid.optional() });
export type SaveVoiceDto = z.output<typeof saveVoiceSchema>;
