import { SetMetadata } from '@nestjs/common';
import type { z } from 'zod';

export const API_CONTRACT = Symbol('API_CONTRACT');
export interface ApiRouteDefinition {
  method: string;
  path: string;
  status: number;
  requestSchema?: z.ZodType;
  responseSchema?: z.ZodType;
}
export function ApiContract(route: Omit<ApiRouteDefinition, 'requestSchema'>, requestSchema?: z.ZodType) {
  return SetMetadata(API_CONTRACT, { ...route, requestSchema });
}
