import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

export function sendApiError(error: any, request: Request, response: Response) {
  if (response.headersSent || response.destroyed) {
    return;
  }

  const status = error instanceof ZodError ? 422 : error instanceof HttpException ? error.getStatus() : error.status || 500;

  console.error(JSON.stringify({ requestId: request.requestId, status, code: error.code || error.name }));
  response.status(status).json({
    error: {
      code: status === 409 ? 'REVISION_CONFLICT' : status === 422 ? 'VALIDATION_ERROR' : 'REQUEST_FAILED',
      message:
        status === 500
          ? 'Internal server error'
          : error instanceof ZodError
            ? error.issues.map((issue) => issue.message).join('; ')
            : error.message,
      requestId: request.requestId,
    },
  });
}
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();

    sendApiError(error, http.getRequest<Request>(), http.getResponse<Response>());
  }
}
