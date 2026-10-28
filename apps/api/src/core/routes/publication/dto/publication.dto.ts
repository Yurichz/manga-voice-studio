import { uuid } from '@mvs/backend/common';
import { z } from 'zod';

export const exportPublicationSchema = z.object({
  chapterIds: z
    .array(uuid)
    .min(1)
    .max(250)
    .refine((ids) => new Set(ids).size === ids.length),
  description: z.string().max(10000).default(''),
  credits: z
    .array(z.object({ role: z.string().min(1).max(100), name: z.string().min(1).max(200) }))
    .max(100)
    .default([]),
  coverPageId: uuid.nullable().default(null),
});
export type ExportPublicationDto = z.output<typeof exportPublicationSchema>;
