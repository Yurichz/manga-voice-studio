import { z } from 'zod';

export const PagesEntity = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    chapterId: z.uuid(),
    order: z.number().int(),
    revision: z.number().int(),
    width: z.number(),
    height: z.number(),
    imageKey: z.string(),
    previewKey: z.string(),
  })
  .loose();
export type PagesEntity = z.output<typeof PagesEntity>;
