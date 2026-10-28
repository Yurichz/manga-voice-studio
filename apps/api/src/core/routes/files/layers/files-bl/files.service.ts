import { AccessService } from '@mvs/backend/access';
import { ApiError } from '@mvs/backend/common';
import { FilesRepository } from '@mvs/backend/repositories/files';
import { storage } from '@mvs/storage';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class FilesService {
  constructor(
    @Inject(FilesRepository)
    private readonly repository: FilesRepository,
    @Inject(AccessService)
    private readonly access: AccessService,
  ) {}

  async downloadFile(ownerId: string, projectId: string, fileSuffix: string | string[]) {
    await this.access.project(ownerId, projectId);
    const suffix = Array.isArray(fileSuffix) ? fileSuffix.join('/') : fileSuffix;
    const key = projectId + '/' + suffix;
    const allowed = /\.(png|webp|wav|zip)$/.test(key);

    if (!allowed || suffix.startsWith('imports/') || suffix.startsWith('sources/')) {
      throw new ApiError(404, 'Файл не найден');
    }

    const render = await this.repository.downloadFileChapterRenderFindFirst(projectId, key, key);

    if (suffix.startsWith('publications/') && !(await this.repository.downloadFileJobFindFirst(projectId, key))) {
      throw new ApiError(404, 'Экспорт ещё не готов');
    }

    if (suffix.startsWith('publication/')) {
      throw new ApiError(404, 'Файл не найден');
    }

    if (suffix.startsWith('renders/') && !render) {
      throw new ApiError(404, 'Проверенная сборка не найдена');
    }

    if (render && render.inputRevision !== render.chapter.revision) {
      throw new ApiError(409, 'Сборка главы устарела');
    }

    return storage.resolve(key);
  }
}
