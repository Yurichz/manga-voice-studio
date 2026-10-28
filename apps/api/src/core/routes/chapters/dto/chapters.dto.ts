import { revision, title, uuid } from '@mvs/backend/common';
import { z } from 'zod';

export const createChapterSchema = z.object({ title });
export type CreateChapterDto = z.output<typeof createChapterSchema>;
export const updateChapterSchema = z.object({
  expectedRevision: revision,
  title: title.optional(),
  readingDirection: z.enum(['rtl', 'ltr']).nullable().optional(),
  pageIds: z.array(uuid).max(50).optional(),
});
export type UpdateChapterDto = z.output<typeof updateChapterSchema>;
