import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

export const Owner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => context.switchToHttp().getRequest().ownerId,
);
