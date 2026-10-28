import { Prisma } from '@mvs/database';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export const uuid = z.uuid();
export const title = z.string().trim().min(1).max(200);
export const revision = z.number().int().nonnegative();
export const idempotencySchema = z.string().min(8).max(200);
export const json = (value: unknown) => value as Prisma.InputJsonValue;
export function filename(value: string) {
  if ([...value].some((x) => x.charCodeAt(0) > 255)) {
    return value;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(value, 'latin1'));
  } catch {
    return value;
  }
}
