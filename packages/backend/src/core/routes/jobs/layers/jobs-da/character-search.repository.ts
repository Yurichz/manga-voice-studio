import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class CharacterSearchRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  handleSqlQueryRaw(value1: string, value2: string, value3: string, value4: string, value5: any, value6: string) {
    return this.$.$queryRaw`
SELECT nearest."characterId", nearest.name, nearest.similarity
      FROM (SELECT DISTINCT ON (r."characterId") r."characterId", c.name,
        1-(r.embedding <=> ${value1}::vector) as similarity,
        r.embedding <=> ${value2}::vector as distance
      FROM "CharacterReference" r
      JOIN "Character" c ON c.id=r."characterId"
      JOIN "Project" p ON p.id=r."projectId"
      WHERE r."projectId"=${value3}
      AND p."ownerId"=${value4}
      AND p."deletedAt" IS NULL
      AND r.confirmed=true
      AND r."encoderRevision"=${value5}
      AND r.embedding IS NOT NULL
      ORDER BY r."characterId", r.embedding <=> ${value6}::vector) nearest
      ORDER BY nearest.distance
      LIMIT 5
    `;
  }
}
