import { revision } from '@mvs/backend/common';
import { projectSchema } from '@mvs/contracts';
import { z } from 'zod';

export const createProjectSchema = projectSchema;
export type CreateProjectDto = z.output<typeof createProjectSchema>;
export const updateProjectSchema = projectSchema.extend({ expectedRevision: revision });
export type UpdateProjectDto = z.output<typeof updateProjectSchema>;
