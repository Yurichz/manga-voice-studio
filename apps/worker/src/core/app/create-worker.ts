import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { WorkerModule } from './worker.module.js';

export async function createWorker() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger: ['error', 'warn', 'log'] });

  app.enableShutdownHooks();

  return app;
}
