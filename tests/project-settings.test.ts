import { expect, it } from 'vitest';
import { projectSchema } from '@mvs/contracts';
import { updateProjectSchema } from '../apps/api/src/core/routes/projects/dto/projects.dto.js';

it('defaults new projects to English with an independent RTL direction', () => {
  expect(projectSchema.parse({ title: 'New project' })).toEqual({
    title: 'New project', textLanguage: 'en', speechLanguage: 'English', readingDirection: 'rtl',
  });
  expect(projectSchema.parse({ title: 'Русская история', textLanguage: 'ru', speechLanguage: 'Russian', readingDirection: 'ltr' }))
    .toMatchObject({ textLanguage: 'ru', speechLanguage: 'Russian', readingDirection: 'ltr' });
});

it('does not fill missing PATCH settings with creation defaults', () => {
  expect(updateProjectSchema.parse({ title: 'Renamed', expectedRevision: 4 })).toEqual({ title: 'Renamed', expectedRevision: 4 });
  expect(updateProjectSchema.parse({ speechLanguage: 'Russian', expectedRevision: 4 }))
    .toEqual({ speechLanguage: 'Russian', expectedRevision: 4 });
  expect(updateProjectSchema.safeParse({ title: 'Renamed' }).success).toBe(false);
});
