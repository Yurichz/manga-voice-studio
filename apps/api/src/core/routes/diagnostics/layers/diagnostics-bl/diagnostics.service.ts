import { DiagnosticsRepository } from '@mvs/backend/repositories/diagnostics';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class DiagnosticsService {
  constructor(
    @Inject(DiagnosticsRepository)
    private readonly repository: DiagnosticsRepository,
  ) {}

  async health(_ownerId: string) {
    const status: any = { api: 'ready', database: 'unavailable', queue: 'unavailable', ai: 'unavailable' };

    try {
      await this.repository.healthSqlQueryRaw();
      status.database = 'ready';
    } catch {}

    try {
      const { Redis } = await import('ioredis');
      const redis = new Redis(process.env.REDIS_URL!, {
        connectTimeout: 1000,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
        lazyConnect: true,
      });

      try {
        await redis.connect();
        await redis.ping();
        status.queue = 'ready';
      } finally {
        redis.disconnect();
      }
    } catch {}

    try {
      const r = await fetch((process.env.AI_URL || 'http://127.0.0.1:8001') + '/health', {
        headers: { 'X-AI-Secret': process.env.AI_SECRET! },
        signal: AbortSignal.timeout(2000),
      });

      status.ai = await r.json();
    } catch {}

    return status;
  }
}
