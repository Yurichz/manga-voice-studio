import { AccessService } from '@mvs/backend/access';
import { ApiError, json } from '@mvs/backend/common';
import { JobEnqueueClService } from '@mvs/backend/jobs';
import { CharactersRepository } from '@mvs/backend/repositories/characters';
import { storage } from '@mvs/storage';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import {
  type ConfirmAppearanceDto,
  type CreateCharacterDto,
  type CreateReferenceDto,
  type MergeCharacterDto,
  type UpdateCharacterDto,
} from '../../dto/characters.dto.js';
import { CharactersClService } from '../characters-cl/characters-cl.service.js';

@Injectable()
export class CharactersService {
  constructor(
    @Inject(CharactersClService)
    private readonly coordinator: CharactersClService,
    @Inject(CharactersRepository)
    private readonly repository: CharactersRepository,
    @Inject(AccessService)
    private readonly access: AccessService,
    @Inject(JobEnqueueClService)
    private readonly jobs: JobEnqueueClService,
  ) {}

  async createCharacter(ownerId: string, projectId: string, input: CreateCharacterDto) {
    const p = await this.access.project(ownerId, projectId);
    const v = input;

    return await this.repository.createCharacterCharacterCreate(v, p.id);
  }

  async updateCharacter(ownerId: string, characterId: string, input: UpdateCharacterDto) {
    return this.coordinator.updateCharacter(ownerId, characterId, input);
  }

  async mergeCharacter(ownerId: string, characterId: string, input: MergeCharacterDto) {
    return this.coordinator.mergeCharacter(ownerId, characterId, input);
  }

  async undoMerge(ownerId: string, mergeId: string) {
    return this.coordinator.undoMerge(ownerId, mergeId);
  }

  async listMerges(ownerId: string, projectId: string) {
    const p = await this.access.project(ownerId, projectId);

    return await this.repository.listMergesCharacterMergeFindMany(p.id);
  }

  async previewMerge(ownerId: string, characterId: string) {
    const c = await this.repository.previewMergeCharacterFindUnique(characterId);

    if (!c) {
      throw new ApiError(404, 'Персонаж не найден');
    }

    await this.access.project(ownerId, c.projectId);

    return await this.repository.previewMergeUtteranceFindMany(c.projectId, c.id);
  }

  async deleteReference(ownerId: string, referenceId: string) {
    const ref = await this.repository.deleteReferenceCharacterReferenceFindUnique(referenceId);

    if (!ref) {
      throw new ApiError(404, 'Референс не найден');
    }

    await this.access.project(ownerId, ref.projectId);
    await this.repository.deleteReferenceCharacterReferenceDelete(ref.id);

    return { deleted: true };
  }

  async confirmAppearance(ownerId: string, appearanceId: string, input: ConfirmAppearanceDto) {
    const a = await this.repository.confirmAppearanceCharacterAppearanceFindUnique(appearanceId);

    if (!a) {
      throw new ApiError(404, 'Область не найдена');
    }

    await this.access.project(ownerId, a.projectId);
    const v = input;

    if (v.characterId && !(await this.repository.confirmAppearanceCharacterFindFirst(v.characterId, a.projectId))) {
      throw new ApiError(422, 'Персонаж другого проекта');
    }

    return await this.repository.confirmAppearanceCharacterAppearanceUpdate(a.id, v.characterId);
  }

  async createReference(ownerId: string, characterId: string, input: CreateReferenceDto) {
    const c = await this.repository.createReferenceCharacterFindUnique(characterId);

    if (!c) {
      throw new ApiError(404, 'Персонаж не найден');
    }

    const v = input;
    const p = await this.access.page(ownerId, v.pageId);

    if (p.projectId !== c.projectId) {
      throw new ApiError(422, 'Страница другого проекта');
    }

    const crop = await sharp(await storage.read(p.imageKey))
      .extract({
        left: Math.floor(v.bbox.x * p.width),
        top: Math.floor(v.bbox.y * p.height),
        width: Math.max(1, Math.floor(v.bbox.width * p.width)),
        height: Math.max(1, Math.floor(v.bbox.height * p.height)),
      })
      .png()
      .toBuffer();
    const cropKey = p.projectId + '/references/' + randomUUID() + '.png';

    await storage.write(cropKey, crop);
    const ref = await this.repository.createReferenceCharacterReferenceCreate(p.projectId, c.id, p.id, json(v.bbox), cropKey);
    const j = await this.jobs.job(ownerId, p.projectId, 'embedding', { referenceId: ref.id, cropKey }, ref.id);

    return { reference: ref, jobId: j.id };
  }
}
