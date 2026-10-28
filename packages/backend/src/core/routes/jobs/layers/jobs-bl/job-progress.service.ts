import { JobProgressRepository } from '@mvs/backend/repositories/job-progress';
import { progressSchema, type JobProgress } from '@mvs/contracts';
import { Prisma } from '@mvs/database';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class JobProgressService {
  constructor(
    @Inject(JobProgressRepository)
    private readonly repository: JobProgressRepository,
  ) {}

  async write(jobId: string, attemptToken: string, value: JobProgress) {
    return this.repository.writeJobUpdateMany(jobId, attemptToken, value.phase, progressSchema.parse(value) as Prisma.InputJsonValue);
  }
}
