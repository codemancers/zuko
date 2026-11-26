import { ApiError, type FieldError } from '@/lib/api';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

/** The largest file Zuko stores. The server enforces the same cap. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** A file as the API describes it, where it is attached or after an upload. */
export interface AttachedFile {
  id: string;
  filename: string;
  media_type: string;
  size: number;
}

/** Where the file's bytes are: images and PDFs open in the browser, everything else downloads. */
export const fileUrl = (id: string) => `${BACKEND_URL}/api/v1/files/${encodeURIComponent(id)}/content`;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

/** What is wrong with a file before it is sent, if anything. */
export function checkFile(file: Pick<File, 'name' | 'size'>): string | undefined {
  if (file.size === 0) return `${file.name} is empty`;
  if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 25 MB`;
  return undefined;
}

/** A value read from a FILE field as a list: one file, several, or none. */
export const filesOf = (value: unknown): AttachedFile[] =>
  (Array.isArray(value) ? value : value ? [value] : []).filter(
    (v): v is AttachedFile => !!v && typeof v === 'object' && typeof (v as AttachedFile).id === 'string',
  );

/**
 * Upload one file. The bytes go to Zuko's file store as a multipart request and come back as an id;
 * attach the id to a record or a comment. Nothing is ever sent inline in another request.
 */
export async function uploadFile(file: File): Promise<AttachedFile> {
  const problem = checkFile(file);
  if (problem) throw new ApiError(problem, 400, 'INVALID_FILE');
  const body = new FormData();
  body.append('file', file, file.name);
  const response = await fetch(`${BACKEND_URL}/api/v1/files`, { method: 'POST', credentials: 'include', body });
  const result = (await response.json().catch(() => null)) as
    | (Partial<AttachedFile> & { message?: string; code?: string; errors?: FieldError[] })
    | null;
  if (!response.ok || !result?.id) {
    throw new ApiError(
      response.status === 413 ? 'Files must be 25 MB or smaller' : (result?.message ?? `Upload failed (${response.status})`),
      response.status,
      result?.code,
      result?.errors,
    );
  }
  return result as AttachedFile;
}
