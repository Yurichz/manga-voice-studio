import { revision, uuid } from '@mvs/backend/common';
import { z } from 'zod';

export const speechUtteranceSchema = z.object({ allowUnreviewed: z.boolean().default(false), variation: z.boolean().default(false) });
export type SpeechUtteranceDto = z.output<typeof speechUtteranceSchema>;
export const selectAudioSchema = z.object({ artifactId: uuid, expectedRevision: revision });
export type SelectAudioDto = z.output<typeof selectAudioSchema>;
export const speechChapterSchema = z.object({ allowUnreviewed: z.boolean().default(false) });
export type SpeechChapterDto = z.output<typeof speechChapterSchema>;
