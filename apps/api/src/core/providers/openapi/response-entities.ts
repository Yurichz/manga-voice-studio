import { jobProgressResponseSchema, pronunciationPreviewSchema } from '@mvs/contracts';
import { z } from 'zod';
import { ChaptersEntity } from '../../routes/chapters/entities/chapters.entity.js';
import { CharactersEntity } from '../../routes/characters/entities/characters.entity.js';
import { IdentityEntity } from '../../routes/identity/entities/identity.entity.js';
import { JobsEntity } from '../../routes/jobs/entities/jobs.entity.js';
import { PagesEntity } from '../../routes/pages/entities/pages.entity.js';
import { ProjectsEntity } from '../../routes/projects/entities/projects.entity.js';
import { VoicesEntity } from '../../routes/voices/entities/voices.entity.js';
import type { ApiRouteDefinition } from './api-contract.decorator.js';

export function responseEntity(route: ApiRouteDefinition): z.ZodType | undefined {
  const key = route.method.toUpperCase() + ' ' + route.path;

  if (key === 'GET /me') {
    return IdentityEntity;
  }

  if (key === 'GET /projects') {
    return ProjectsEntity.array();
  }

  if (['POST /projects', 'GET /projects/:projectId', 'PATCH /projects/:projectId'].includes(key)) {
    return ProjectsEntity;
  }

  if (['POST /projects/:projectId/chapters', 'GET /chapters/:chapterId'].includes(key)) {
    return ChaptersEntity;
  }

  if (['GET /pages/:pageId', 'PUT /pages/:pageId', 'POST /analyses/:analysisId/apply'].includes(key)) {
    return PagesEntity;
  }

  if (['POST /projects/:projectId/characters', 'PATCH /characters/:characterId'].includes(key)) {
    return CharactersEntity;
  }

  if (key === 'POST /jobs/:jobId/save-voice') {
    return VoicesEntity;
  }

  if (key === 'GET /projects/:projectId/job-progress') {
    return jobProgressResponseSchema;
  }

  if (key === 'GET /utterances/:utteranceId/pronunciation') {
    return pronunciationPreviewSchema;
  }

  if (key === 'GET /projects/:projectId/jobs') {
    return JobsEntity.array();
  }

  if (key === 'GET /jobs/:jobId') {
    return JobsEntity;
  }

  if (key === 'POST /chapters/:chapterId/speech') {
    return z.object({ jobIds: z.array(z.uuid()), batchId: z.uuid(), remaining: z.number().int().nonnegative() });
  }

  if (key === 'DELETE /pages/:pageId') {
    return z.object({ deleted: z.literal(true), cancelRequested: z.number().int().nonnegative() });
  }

  if (key === 'DELETE /chapters/:chapterId/pages') {
    return z.object({
      deleted: z.literal(true),
      deletedCount: z.number().int().min(1).max(50),
      cancelRequested: z.number().int().nonnegative(),
    });
  }

  if (route.status === 202 && !route.path.endsWith('/cancel') && route.method !== 'delete') {
    return z.object({ jobId: z.uuid() }).loose();
  }

  return undefined;
}
