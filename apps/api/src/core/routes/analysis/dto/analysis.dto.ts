import { revision } from '@mvs/backend/common';
import { bboxSchema } from '@mvs/contracts';
import { z } from 'zod';

export const findCandidatesSchema = z.object({ bbox: bboxSchema });
export type FindCandidatesDto = z.output<typeof findCandidatesSchema>;
export const applyAnalysisSchema = z.object({
  expectedRevision: revision,
  utteranceIndices: z.array(z.number().int().nonnegative()).max(500),
  includePanels: z.boolean().default(false),
});
export type ApplyAnalysisDto = z.output<typeof applyAnalysisSchema>;
