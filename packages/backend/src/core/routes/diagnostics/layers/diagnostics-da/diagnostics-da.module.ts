import { PrismaModule } from '@mvs/backend/prisma';
import { Module } from '@nestjs/common';
import { DiagnosticsRepository } from './diagnostics.repository.js';

@Module({ imports: [PrismaModule], providers: [DiagnosticsRepository], exports: [DiagnosticsRepository] })
export class DiagnosticsDaModule {}
