import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { FileStorage } from './storage';

/** What the engine leaves on `req.file`: where the bytes went and what was in the first of them. */
export interface StoredUpload {
  key: string;
  size: number;
  sha256: string;
}

/** The part of multer's storage-engine contract this uses (multer's own types are not a dependency). */
interface MulterFile {
  stream: Readable;
  [key: string]: unknown;
}
interface MulterStorageEngine {
  _handleFile(req: unknown, file: MulterFile, callback: (error?: unknown, info?: Record<string, unknown>) => void): void;
  _removeFile(req: unknown, file: Record<string, unknown>, callback: (error: Error | null) => void): void;
}

/** The slice of the request the engine reads: the tenant set by CrmContextGuard. */
interface TenantRequest {
  crm?: { organizationId: bigint };
}

export const storageKey = (organizationId: bigint) => `${organizationId}/${randomBytes(16).toString('hex')}`;

/**
 * Multer storage that streams each upload into a FileStorage driver, so nothing is buffered in
 * memory and swapping local disk for S3 needs no change here. The size cap is multer's `fileSize`
 * limit plus the driver's own check.
 */
export function createMulterStorage(storage: FileStorage): MulterStorageEngine {
  return {
    _handleFile(req, file, callback) {
      const organizationId = (req as unknown as TenantRequest).crm?.organizationId;
      if (organizationId === undefined) return callback(new Error('Uploads need an authenticated organization.'));
      const key = storageKey(organizationId);
      storage
        .put(key, file.stream)
        .then(({ size, sha256 }) => callback(null, { key, size, sha256 }))
        .catch((error: unknown) => callback(error));
    },
    _removeFile(_req, file, callback) {
      const key = (file as Partial<StoredUpload>).key;
      if (!key) return callback(null);
      storage.delete(key).then(
        () => callback(null),
        (error: unknown) => callback(error instanceof Error ? error : new Error(String(error))),
      );
    },
  };
}
