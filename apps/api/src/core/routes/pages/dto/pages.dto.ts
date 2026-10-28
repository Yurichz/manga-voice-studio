import { revision } from '@mvs/backend/common';
import { pageEditSchema, pagesDeleteSchema } from '@mvs/contracts';
import { z } from 'zod';

export const updatePageSchema = pageEditSchema;
export type UpdatePageDto = z.output<typeof updatePageSchema>;
export const deletePageSchema = z.object({ expectedRevision: revision, confirm: z.literal(true) });
export type DeletePageDto = z.output<typeof deletePageSchema>;
export const deleteChapterPagesSchema = pagesDeleteSchema;
export type DeleteChapterPagesDto = z.output<typeof deleteChapterPagesSchema>;
