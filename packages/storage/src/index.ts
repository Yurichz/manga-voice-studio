import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface StorageProvider {
  read(key: string): Promise<Buffer>;
  write(key: string, data: Buffer): Promise<void>;
  removeProject(projectId: string): Promise<void>;
}
export class LocalStorageProvider implements StorageProvider {
  readonly root = path.resolve(process.env.STORAGE_ROOT || 'storage/private');

  resolve(key: string) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(key) || key.split('/').some((x) => x === '..' || x === '')) {
      throw new Error('Invalid storage key');
    }

    const p = path.resolve(this.root, key);

    if (!p.startsWith(this.root + path.sep)) {
      throw new Error('Invalid storage key');
    }

    return p;
  }

  async read(key: string) {
    return fs.readFile(this.resolve(key));
  }

  async write(key: string, data: Buffer) {
    const p = this.resolve(key);

    await fs.mkdir(path.dirname(p), { recursive: true });
    const tmp = p + '.' + randomUUID() + '.tmp';

    try {
      await fs.writeFile(tmp, data, { flag: 'wx' });
      await fs.rename(tmp, p);
    } finally {
      await fs.rm(tmp, { force: true });
    }
  }

  async removeProject(projectId: string) {
    if (!/^[a-f0-9-]{36}$/.test(projectId)) {
      throw new Error('Invalid project');
    }

    await fs.rm(this.resolve(projectId), { recursive: true, force: true });
  }
}
export const storage = new LocalStorageProvider();
