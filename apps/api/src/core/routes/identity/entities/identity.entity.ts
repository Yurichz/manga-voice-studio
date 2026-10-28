import { z } from 'zod';

export const IdentityEntity = z.object({ ownerId: z.string(), demo: z.boolean() }).loose();
export type IdentityEntity = z.output<typeof IdentityEntity>;
