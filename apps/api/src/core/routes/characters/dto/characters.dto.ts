import { revision, title, uuid } from '@mvs/backend/common';
import { bboxSchema } from '@mvs/contracts';
import { z } from 'zod';

export const createCharacterSchema = z.object({ name: title, description: z.string().max(2000).default('') });
export type CreateCharacterDto = z.output<typeof createCharacterSchema>;
export const updateCharacterSchema = z.object({
  expectedRevision: revision,
  name: title.optional(),
  description: z.string().max(2000).optional(),
  defaultVoiceVersionId: uuid.nullable().optional(),
});
export type UpdateCharacterDto = z.output<typeof updateCharacterSchema>;
export const mergeCharacterSchema = z.object({
  targetId: uuid,
  sourceRevision: revision,
  targetRevision: revision,
  voiceVersionId: uuid.nullable(),
  confirm: z.literal(true),
});
export type MergeCharacterDto = z.output<typeof mergeCharacterSchema>;
export const confirmAppearanceSchema = z.object({ characterId: uuid.nullable() });
export type ConfirmAppearanceDto = z.output<typeof confirmAppearanceSchema>;
export const createReferenceSchema = z.object({ pageId: uuid, bbox: bboxSchema });
export type CreateReferenceDto = z.output<typeof createReferenceSchema>;
