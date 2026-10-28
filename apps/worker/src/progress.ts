import { JobProgressService } from '@mvs/backend/jobs';
import { PrismaService } from '@mvs/backend/prisma';
import { JobProgressRepository } from '@mvs/backend/repositories/job-progress';
import type { JobProgress } from '@mvs/contracts';

// Compatibility for existing verification scripts; production uses injected providers.
export function writeJobProgress(jobId: string, attemptToken: string, value: JobProgress) {
  return new JobProgressService(new JobProgressRepository(new PrismaService())).write(jobId, attemptToken, value);
}
