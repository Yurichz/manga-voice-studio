import yauzl from 'yauzl';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

export const limits = {
  pages: 50,
  imageBytes: 20 * 1024 * 1024,
  pixels: 40_000_000,
  totalBytes: 500 * 1024 * 1024,
  entries: 200,
  ratio: 100,
};
export function safeArchiveName(name: string, attributes: number) {
  if (
    name.includes('\\') ||
    name.startsWith('/') ||
    /^[a-z]:/i.test(name) ||
    name.split('/').includes('..') ||
    ((attributes >>> 16) & 0xf000) === 0xa000
  ) {
    throw new Error('Небезопасный путь или symlink в архиве');
  }
}
export function isZip(b: Buffer) {
  return b.length >= 4 && b.readUInt32LE(0) === 0x04034b50;
}
export async function unpack(buffer: Buffer): Promise<{ name: string; data: Buffer }[]> {
  if (buffer.length > limits.totalBytes) {
    throw new Error('Превышен размер импорта');
  }

  return new Promise((resolve, reject) =>
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (err, zip) => {
      if (err || !zip) {
        return reject(err || new Error('Invalid ZIP'));
      }

      let total = 0,
        count = 0;
      const files: { name: string; data: Buffer }[] = [];
      let failed = false;
      const fail = (e: unknown) => {
        if (!failed) {
          failed = true;
          zip.close();
          reject(e);
        }
      };

      zip.on('error', fail);
      zip.on('end', () => {
        if (!failed) {
          resolve(files.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })));
        }
      });
      zip.on('entry', (entry) => {
        try {
          safeArchiveName(entry.fileName, entry.externalFileAttributes);
          if (++count > limits.entries) {
            throw new Error('Слишком много элементов');
          }

          if (entry.generalPurposeBitFlag & 1) {
            throw new Error('Зашифрованные архивы не поддерживаются');
          }

          if (/\/$/.test(entry.fileName)) {
            zip.readEntry();

            return;
          }

          if (!/\.(png|jpe?g|webp)$/i.test(entry.fileName)) {
            throw new Error('Архив должен содержать только изображения PNG/JPEG/WebP');
          }

          total += entry.uncompressedSize;
          if (
            total > limits.totalBytes ||
            entry.uncompressedSize > limits.imageBytes ||
            entry.uncompressedSize / Math.max(entry.compressedSize, 1) > limits.ratio
          ) {
            throw new Error('Превышены лимиты распаковки');
          }

          zip.openReadStream(entry, (e, stream) => {
            if (e || !stream) {
              return fail(e);
            }

            const chunks: Buffer[] = [];
            let size = 0;

            stream.on('data', (b: Buffer) => {
              size += b.length;
              if (size > limits.imageBytes) {
                stream.destroy();
                fail(new Error('Превышен размер изображения'));
              } else {
                chunks.push(b);
              }
            });
            stream.on('error', fail);
            stream.on('end', () => {
              if (!failed) {
                files.push({ name: entry.fileName, data: Buffer.concat(chunks) });
                if (files.length > limits.pages) {
                  return fail(new Error('Максимум 50 страниц'));
                }

                zip.readEntry();
              }
            });
          });
        } catch (e) {
          fail(e);
        }
      });
      zip.readEntry();
    }),
  );
}
export async function normalize(data: Buffer) {
  if (data.length > limits.imageBytes) {
    throw new Error('Изображение превышает 20 MiB');
  }

  const image = sharp(data, { limitInputPixels: limits.pixels, failOn: 'warning' });
  const m = await image.metadata();

  if (!['png', 'jpeg', 'webp'].includes(m.format || '')) {
    throw new Error('Неподдерживаемый формат изображения');
  }

  const { data: canonical, info } = await image.rotate().png().toBuffer({ resolveWithObject: true });
  const preview = await sharp(canonical)
    .resize({ width: 220, height: 320, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  return {
    canonical,
    preview,
    width: info.width,
    height: info.height,
    checksum: createHash('sha256').update(data).digest('hex'),
    transform: { exifOrientation: m.orientation || 1, canonicalWidth: info.width, canonicalHeight: info.height },
  };
}
