import { z } from 'zod';

export const VoicesEntity = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    profileId: z.uuid(),
    referenceKey: z.string(),
    transcript: z.string(),
    language: z.string(),
  })
  .loose();
export type VoicesEntity = z.output<typeof VoicesEntity>;
