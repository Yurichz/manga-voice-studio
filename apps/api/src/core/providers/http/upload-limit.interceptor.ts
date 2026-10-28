import { ApiError } from '@mvs/backend/common';
import { limits } from '@mvs/storage/import';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import multer from 'multer';

export const uploadOptions = { storage: multer.memoryStorage(), limits: { fileSize: limits.totalBytes, files: 50, fields: 0 } };
@Injectable()
export class UploadLimitInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const limit = limits.totalBytes + 1024 * 1024;

    if (Number(request.get('Content-Length') || 0) > limit) {
      throw new ApiError(413, 'The import exceeds 500 MiB');
    }

    let bytes = 0;

    // Authentication must finish before attaching this listener, or multipart chunks can be lost.
    request.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > limit) {
        if (!response.headersSent) {
          response.status(413).end();
        }

        request.destroy();
      }
    });

    return next.handle();
  }
}
