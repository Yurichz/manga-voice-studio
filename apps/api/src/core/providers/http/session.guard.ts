import { AuthService } from '@mvs/backend/auth';
import { ApiError } from '@mvs/backend/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly quotas = new Map<string, { at: number; count: number }>();

  constructor(@Inject(AuthService) private readonly sessions: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    if (!request.path.startsWith('/api/v1')) {
      return true;
    }

    const session = await this.sessions.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });

    if (!session) {
      throw new ApiError(401, 'Требуется вход');
    }

    request.ownerId = session.user.id;
    const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);

    if (!read) {
      if (process.env.DEMO_MODE === 'true') {
        throw new ApiError(403, 'Демо доступно только для чтения');
      }

      if (request.get('Origin') !== new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3000').origin) {
        throw new ApiError(403, 'Недопустимый Origin');
      }
    }

    const key = request.ownerId + (read ? ':read' : ':write');
    const quota = this.quotas.get(key);

    if (!quota || Date.now() - quota.at > 60000) {
      this.quotas.set(key, { at: Date.now(), count: 1 });
    } else if (++quota.count > (read ? 600 : 180)) {
      response.setHeader('Retry-After', Math.ceil((60000 - (Date.now() - quota.at)) / 1000));
      throw new ApiError(429, 'Слишком много запросов');
    }

    // Bound the per-process quota map without changing its one-minute windows.
    if (this.quotas.size > 10000) {
      for (const [id, value] of this.quotas) {
        if (Date.now() - value.at > 60000) {
          this.quotas.delete(id);
        }
      }
    }

    return true;
  }
}
