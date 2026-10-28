import type { JobProgress } from '@mvs/contracts';
import type { Prisma } from '@mvs/database';

export type StoredJob = Prisma.JobGetPayload<Record<string, never>>;
export type StoredProject = Prisma.ProjectGetPayload<Record<string, never>>;
export type PhaseReporter = (phase: string, completed?: number, total?: number, unit?: JobProgress['unit']) => Promise<void>;
export interface JobContext {
  job: StoredJob;
  input: any;
  project: StoredProject;
  token: string;
  phase: PhaseReporter;
  runAI: (kind: string, input: unknown) => Promise<any>;
}
export interface JobOutput {
  result: any;
  extra?: any;
}
export interface JobHandler {
  readonly kinds: readonly string[];
  handle(context: JobContext): Promise<JobOutput>;
}
export const JOB_HANDLERS = Symbol('JOB_HANDLERS');
