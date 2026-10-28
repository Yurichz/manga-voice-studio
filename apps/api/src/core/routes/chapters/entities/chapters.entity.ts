import { z } from 'zod';

export const ChaptersEntity = z
  .object({ id: z.uuid(), projectId: z.uuid(), title: z.string(), order: z.number().int(), revision: z.number().int() })
  .loose();
export type ChaptersEntity = z.output<typeof ChaptersEntity>;
