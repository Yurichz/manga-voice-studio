import { DiagnosticsDaModule } from '@mvs/backend/modules/diagnostics-da';
import { Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics.controller.js';
import { DiagnosticsService } from './diagnostics.service.js';

@Module({ imports: [DiagnosticsDaModule], controllers: [DiagnosticsController], providers: [DiagnosticsService] })
export class DiagnosticsBlModule {}
