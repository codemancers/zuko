import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { MAX_FILE_BYTES } from './file-types';

export class FileTooLargeError extends Error {
  constructor() {
    super('Files must be 25 MB or smaller.');
  }
}

interface PutResult {
  size: number;
  sha256: string;
}

/** Where file bytes live. Only the local-disk driver exists today; an S3 driver can implement this. */
export interface FileStorage {
  /** Stream `source` to `key`, enforcing the size cap while reading. Leaves nothing behind on failure. */
  put(key: string, source: AsyncIterable<Uint8Array>): Promise<PutResult>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

/** FILES_DIR if set (absolute), otherwise `storage/files` at the workspace root. */
function filesDirectory(start = process.cwd()): string {
  const configured = process.env['FILES_DIR']?.trim();
  if (configured) {
    if (!isAbsolute(configured)) throw new Error('FILES_DIR must be an absolute path.');
    return configured;
  }
  let dir = resolve(start);
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('Set FILES_DIR to an absolute directory for uploaded files.');
    dir = parent;
  }
  return join(dir, 'storage', 'files');
}

export function createLocalStorage(root: string = filesDirectory()): FileStorage {
  const base = resolve(root);
  const pathFor = (key: string) => {
    // Keys are generated server-side; refuse anything that could leave the root.
    if (!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(key)) throw new Error('Invalid storage key.');
    return join(base, key);
  };
  return {
    async put(key, source) {
      const destination = pathFor(key);
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      const staging = join(dirname(destination), `.upload-${randomBytes(12).toString('hex')}`);
      let size = 0;
      const hash = createHash('sha256');
      try {
        const handle = await open(staging, 'wx', 0o600);
        try {
          for await (const chunk of source) {
            size += chunk.byteLength;
            if (size > MAX_FILE_BYTES) throw new FileTooLargeError();
            hash.update(chunk);
            await handle.write(chunk); // writes the whole chunk or throws
          }
        } finally {
          await handle.close();
        }
        await rename(staging, destination);
        return { size, sha256: hash.digest('hex') };
      } catch (error) {
        await rm(staging, { force: true });
        throw error;
      }
    },
    async get(key) {
      const path = pathFor(key);
      await stat(path); // throws ENOENT before a stream is handed out
      return createReadStream(path);
    },
    async delete(key) {
      await rm(pathFor(key), { force: true });
    },
  };
}
