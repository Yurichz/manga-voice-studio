import { ApiError } from '@mvs/backend/common';
import { AccessRepository } from '@mvs/backend/repositories/access';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AccessService {
  constructor(
    @Inject(AccessRepository)
    private readonly repository: AccessRepository,
  ) {}

  async project(ownerId: string, projectId: string) {
    const p = await this.repository.projectProjectFindFirst(projectId, ownerId);

    if (!p) {
      throw new ApiError(404, 'Project not found');
    }

    return p;
  }

  async page(ownerId: string, pageId: string) {
    const p = await this.repository.pagePageFindUnique(pageId);

    if (!p) {
      throw new ApiError(404, 'Page not found');
    }

    await this.project(ownerId, p.projectId);

    return p;
  }
}
