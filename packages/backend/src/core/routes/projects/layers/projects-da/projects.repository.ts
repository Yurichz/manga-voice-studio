import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class ProjectsRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  listProjectsProjectFindMany(value1: string) {
    return this.$.project.findMany({ where: { ownerId: value1, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }

  createProjectProjectCreate(
    value1: { title: string; textLanguage: string; speechLanguage: string; readingDirection: 'rtl' | 'ltr' },
    value2: string,
  ) {
    return this.$.project.create({ data: { ...value1, ownerId: value2 } });
  }

  getProjectChapterFindMany(value1: string) {
    return this.$.chapter.findMany({
      where: { projectId: value1 },
      orderBy: { order: 'asc' },
      include: { pages: { orderBy: { order: 'asc' } } },
    });
  }

  getProjectCharacterFindMany(value1: string) {
    return this.$.character.findMany({ where: { projectId: value1 }, include: { references: true } });
  }

  getProjectVoiceProfileFindMany(value1: string) {
    return this.$.voiceProfile.findMany({ where: { projectId: value1 }, include: { versions: { orderBy: { createdAt: 'desc' } } } });
  }

  updateProjectProjectUpdateMany(
    value1: string,
    value2: number,
    value3: { title?: string; textLanguage?: string; speechLanguage?: string; readingDirection?: 'rtl' | 'ltr' },
  ) {
    return this.$.project.updateMany({ where: { id: value1, revision: value2 }, data: { ...value3, revision: { increment: 1 } } });
  }

  updateProjectUtteranceUpdateMany(value1: string) {
    return this.$.utterance.updateMany({ where: { projectId: value1 }, data: { activeAudioId: null, revision: { increment: 1 } } });
  }

  updateProjectPageUpdateMany(value1: string) {
    return this.$.page.updateMany({ where: { projectId: value1 }, data: { revision: { increment: 1 } } });
  }

  updateProjectChapterUpdateMany(value1: string) {
    return this.$.chapter.updateMany({ where: { projectId: value1 }, data: { revision: { increment: 1 } } });
  }

  updateProjectProjectFindUnique(value1: string) {
    return this.$.project.findUnique({ where: { id: value1 } });
  }

  deleteProjectProjectUpdate(value1: string, value2: Date) {
    return this.$.project.update({ where: { id: value1 }, data: { deletedAt: value2 } });
  }

  deleteProjectJobUpdateMany(value1: string) {
    return this.$.job.updateMany({
      where: { projectId: value1, status: { in: ['queued', 'running', 'blocked'] } },
      data: { status: 'cancel_requested' },
    });
  }
}
