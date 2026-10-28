import { z } from 'zod';

export const JobsEntity = z.object({ id: z.uuid(), projectId: z.uuid(), kind: z.string(), status: z.string(), stage: z.string() }).loose();
export type JobsEntity = z.output<typeof JobsEntity>;
