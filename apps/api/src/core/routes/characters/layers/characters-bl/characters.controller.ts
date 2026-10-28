import { uuid } from '@mvs/backend/common';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import { Owner } from '../../../../providers/http/owner.decorator.js';
import { ZodValidationPipe } from '../../../../providers/http/zod-validation.pipe.js';
import { ApiContract } from '../../../../providers/openapi/api-contract.decorator.js';
import {
  confirmAppearanceSchema,
  createCharacterSchema,
  createReferenceSchema,
  mergeCharacterSchema,
  updateCharacterSchema,
  type ConfirmAppearanceDto,
  type CreateCharacterDto,
  type CreateReferenceDto,
  type MergeCharacterDto,
  type UpdateCharacterDto,
} from '../../dto/characters.dto.js';
import { CharactersService } from './characters.service.js';

@Controller('api/v1')
export class CharactersController {
  constructor(@Inject(CharactersService) private readonly service: CharactersService) {}

  @Post('projects/:projectId/characters')
  @HttpCode(201)
  @ApiContract({ method: 'post', path: '/projects/:projectId/characters', status: 201 }, createCharacterSchema)
  async createCharacter(
    @Owner() ownerId: string,
    @Param('projectId', new ZodValidationPipe(uuid)) projectId: string,
    @Body(new ZodValidationPipe(createCharacterSchema)) input: CreateCharacterDto,
  ) {
    return this.service.createCharacter(ownerId, projectId, input);
  }

  @Patch('characters/:characterId')
  @HttpCode(200)
  @ApiContract({ method: 'patch', path: '/characters/:characterId', status: 200 }, updateCharacterSchema)
  async updateCharacter(
    @Owner() ownerId: string,
    @Param('characterId', new ZodValidationPipe(uuid)) characterId: string,
    @Body(new ZodValidationPipe(updateCharacterSchema)) input: UpdateCharacterDto,
  ) {
    return this.service.updateCharacter(ownerId, characterId, input);
  }

  @Post('characters/:characterId/merge')
  @HttpCode(200)
  @ApiContract({ method: 'post', path: '/characters/:characterId/merge', status: 200 }, mergeCharacterSchema)
  async mergeCharacter(
    @Owner() ownerId: string,
    @Param('characterId', new ZodValidationPipe(uuid)) characterId: string,
    @Body(new ZodValidationPipe(mergeCharacterSchema)) input: MergeCharacterDto,
  ) {
    return this.service.mergeCharacter(ownerId, characterId, input);
  }

  @Post('merges/:mergeId/undo')
  @HttpCode(200)
  @ApiContract({ method: 'post', path: '/merges/:mergeId/undo', status: 200 }, undefined)
  async undoMerge(@Owner() ownerId: string, @Param('mergeId', new ZodValidationPipe(uuid)) mergeId: string) {
    return this.service.undoMerge(ownerId, mergeId);
  }

  @Get('projects/:projectId/merges')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/projects/:projectId/merges', status: 200 }, undefined)
  async listMerges(@Owner() ownerId: string, @Param('projectId', new ZodValidationPipe(uuid)) projectId: string) {
    return this.service.listMerges(ownerId, projectId);
  }

  @Get('characters/:characterId/merge-preview')
  @HttpCode(200)
  @ApiContract({ method: 'get', path: '/characters/:characterId/merge-preview', status: 200 }, undefined)
  async previewMerge(@Owner() ownerId: string, @Param('characterId', new ZodValidationPipe(uuid)) characterId: string) {
    return this.service.previewMerge(ownerId, characterId);
  }

  @Delete('references/:referenceId')
  @HttpCode(200)
  @ApiContract({ method: 'delete', path: '/references/:referenceId', status: 200 }, undefined)
  async deleteReference(@Owner() ownerId: string, @Param('referenceId', new ZodValidationPipe(uuid)) referenceId: string) {
    return this.service.deleteReference(ownerId, referenceId);
  }

  @Post('appearances/:appearanceId/confirm')
  @HttpCode(200)
  @ApiContract({ method: 'post', path: '/appearances/:appearanceId/confirm', status: 200 }, confirmAppearanceSchema)
  async confirmAppearance(
    @Owner() ownerId: string,
    @Param('appearanceId', new ZodValidationPipe(uuid)) appearanceId: string,
    @Body(new ZodValidationPipe(confirmAppearanceSchema)) input: ConfirmAppearanceDto,
  ) {
    return this.service.confirmAppearance(ownerId, appearanceId, input);
  }

  @Post('characters/:characterId/references')
  @HttpCode(202)
  @ApiContract({ method: 'post', path: '/characters/:characterId/references', status: 202 }, createReferenceSchema)
  async createReference(
    @Owner() ownerId: string,
    @Param('characterId', new ZodValidationPipe(uuid)) characterId: string,
    @Body(new ZodValidationPipe(createReferenceSchema)) input: CreateReferenceDto,
  ) {
    return this.service.createReference(ownerId, characterId, input);
  }
}
