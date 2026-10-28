import { z } from 'zod';

export const CharactersEntity = z
  .object({ id: z.uuid(), projectId: z.uuid(), name: z.string(), description: z.string(), revision: z.number().int() })
  .loose();
export type CharactersEntity = z.output<typeof CharactersEntity>;
