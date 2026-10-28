import { AccessService } from '@mvs/backend/access';
import { ApiError, json } from '@mvs/backend/common';
import { PrismaService } from '@mvs/backend/prisma';
import { CharactersRepository } from '@mvs/backend/repositories/characters';
import { Inject, Injectable } from '@nestjs/common';
import { type MergeCharacterDto, type UpdateCharacterDto } from '../../dto/characters.dto.js';

@Injectable()
export class CharactersClService {
  constructor(
    @Inject(CharactersRepository)
    private readonly repository: CharactersRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AccessService)
    private readonly access: AccessService,
  ) {}

  async updateCharacter(ownerId: string, characterId: string, input: UpdateCharacterDto) {
    const c = await this.repository.updateCharacterCharacterFindUnique(characterId);

    if (!c) {
      throw new ApiError(404, 'Character not found');
    }

    await this.access.project(ownerId, c.projectId);
    const v = input;

    if (
      v.defaultVoiceVersionId &&
      !(await this.repository.updateCharacterVoiceProfileVersionFindFirst(v.defaultVoiceVersionId, c.projectId))
    ) {
      throw new ApiError(422, 'The voice belongs to another project');
    }

    const { expectedRevision, ...data } = v;

    await this.prisma.$txe(async (tx) => {
      const n = await this.repository.tx(tx).updateCharacterCharacterUpdateMany(c.id, expectedRevision, data);

      if (!n.count) {
        throw new ApiError(409, 'The character revision changed');
      }

      if (data.name !== undefined && data.name !== c.name) {
        await this.repository.tx(tx).updateCharacterChapterUpdateMany(c.projectId, c.id);
      }
    });

    return await this.repository.updateCharacterCharacterFindUnique2(c.id);
  }

  async mergeCharacter(ownerId: string, characterId: string, input: MergeCharacterDto) {
    const source = await this.repository.mergeCharacterCharacterFindUnique(characterId);

    if (!source) {
      throw new ApiError(404, 'Character not found');
    }

    await this.access.project(ownerId, source.projectId);
    const v = input;
    const target = await this.repository.mergeCharacterCharacterFindFirst(v.targetId, source.projectId);

    if (!target || target.id === source.id) {
      throw new ApiError(422, 'Select a different primary character in this project');
    }

    if (v.voiceVersionId && !(await this.repository.mergeCharacterVoiceProfileVersionFindFirst(v.voiceVersionId, source.projectId))) {
      throw new ApiError(422, 'The voice belongs to another project');
    }

    const merge = await this.prisma.$txe(async (tx) => {
      const a = await this.repository.tx(tx).mergeCharacterCharacterUpdateMany(source.id, v.sourceRevision);
      const b = await this.repository.tx(tx).mergeCharacterCharacterUpdateMany2(target.id, v.targetRevision, v.voiceVersionId);

      if (!a.count || !b.count) {
        throw new ApiError(409, 'The characters changed');
      }

      const assignments = await this.repository.tx(tx).mergeCharacterUtteranceFindMany(source.id);
      const refs = await this.repository.tx(tx).mergeCharacterCharacterReferenceFindMany(source.id);

      await this.repository.tx(tx).mergeCharacterUtteranceUpdateMany(source.id, target.id);
      await this.repository.tx(tx).mergeCharacterPageUpdateMany(assignments.map((a) => a.pageId));
      await this.repository.tx(tx).mergeCharacterCharacterReferenceUpdateMany(source.id, target.id);
      await this.repository.tx(tx).mergeCharacterChapterUpdateMany(source.projectId);

      return this.repository.tx(tx).mergeCharacterCharacterMergeCreate(
        source.projectId,
        source.id,
        target.id,
        json({
          sourceRevision: source.revision,
          targetRevision: target.revision,
          targetVoice: target.defaultVoiceVersionId,
          references: refs,
        }),
        json(assignments),
      );
    });

    return { mergeId: merge.id, affectedUtterances: (merge.assignments as any[]).length, pinnedVoicesPreserved: true };
  }

  async undoMerge(ownerId: string, mergeId: string) {
    const m = await this.repository.undoMergeCharacterMergeFindUnique(mergeId);

    if (!m) {
      throw new ApiError(404, 'History not found');
    }

    await this.access.project(ownerId, m.projectId);
    if (m.status !== 'applied') {
      throw new ApiError(409, 'The merge has already been undone');
    }

    const before = m.before as any,
      assignments = m.assignments as any[];
    const conflicts: string[] = [];

    await this.prisma.$txe(async (tx) => {
      const claim = await this.repository.tx(tx).undoMergeCharacterMergeUpdateMany(m.id);

      if (!claim.count) {
        throw new ApiError(409, 'The merge has already been undone');
      }

      for (const a of assignments) {
        const n = await this.repository.tx(tx).undoMergeUtteranceUpdateMany(a.id, m.targetId, a.revision + 1, m.sourceId);

        if (!n.count) {
          conflicts.push(a.id);
        } else {
          await this.repository.tx(tx).undoMergePageUpdate(a.pageId);
        }
      }

      await this.repository.tx(tx).undoMergeCharacterUpdateMany(m.sourceId, before.sourceRevision + 1);
      await this.repository.tx(tx).undoMergeCharacterUpdateMany2(m.targetId, before.targetRevision + 1, before.targetVoice);
      for (const r of before.references) {
        await this.repository.tx(tx).undoMergeCharacterReferenceUpdateMany(r.id, m.targetId, m.sourceId);
      }

      await this.repository.tx(tx).undoMergeChapterUpdateMany(m.projectId);
    });

    return { restored: true, conflicts };
  }
}
