import { fileUrl, type AttachedFile } from '@/lib/files';

/** The most files one message may carry; the agent's channel refuses more. */
export const MAX_MESSAGE_FILES = 10;

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

/**
 * The Zuko file id in one of our own file links, or undefined for anything else. The same exact shape
 * the agent's channel accepts: the backend's origin, /api/v1/files/<id>/content, nothing more.
 */
export function zukoFileId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    const match = /^\/api\/v1\/files\/([1-9]\d{0,18})\/content$/.exec(url.pathname);
    return url.origin === new URL(BACKEND_URL).origin &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? match?.[1]
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * What to send: plain text when there are no files, otherwise a text part (if any) and one file part
 * per upload. A file part carries only the link to the stored file, never its contents.
 */
export function messageContent(text: string, files: AttachedFile[]) {
  if (files.length === 0) return text;
  return [
    ...(text ? [{ type: 'text' as const, text }] : []),
    ...files.map((file) => ({
      type: 'file' as const,
      mediaType: file.media_type,
      filename: file.filename,
      data: fileUrl(file.id),
    })),
  ];
}
