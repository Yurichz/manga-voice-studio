import { BackendModule } from '@mvs/backend';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SessionGuard } from '../providers/http/session.guard.js';
import { OpenApiService } from '../providers/openapi/openapi.service.js';
import { AppBLImports } from './app-bl-imports.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [BackendModule, ...AppBLImports],
  controllers: [AppController],
  providers: [OpenApiService, { provide: APP_GUARD, useClass: SessionGuard }],
})
export class AppModule {}
