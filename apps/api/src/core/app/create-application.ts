import { AuthService } from '@mvs/backend/auth';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { randomUUID } from 'node:crypto';
import 'reflect-metadata';
import { ApiErrorFilter, sendApiError } from '../providers/http/api-error.filter.js';
import { AppModule } from './app.module.js';

export async function createApplication() {
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: ['error', 'warn', 'log'] });

  app.use((request: Request, response: Response, next: NextFunction) => {
    request.requestId = randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    next();
  });
  app.use('/api/auth', toNodeHandler(app.get(AuthService).auth));
  app.use(express.json({ limit: '2mb' }));
  app.useGlobalFilters(new ApiErrorFilter());
  app.enableShutdownHooks();
  await app.init();
  app
    .getHttpAdapter()
    .getInstance()
    .use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
      sendApiError(error, request, response);
    });

  return app;
}
