import { z } from 'zod';

export const ProjectsEntity = z
  .object({
    id: z.uuid(),
    ownerId: z.string(),
    title: z.string(),
    textLanguage: z.string(),
    speechLanguage: z.string(),
    readingDirection: z.enum(['rtl', 'ltr']),
    revision: z.number().int(),
  })
  .loose();
export type ProjectsEntity = z.output<typeof ProjectsEntity>;
