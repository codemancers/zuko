import { fileTypeFromStream } from 'file-type';
import type { Readable } from 'node:stream';

/** Largest file accepted, in bytes. Mirrored by a CHECK constraint on stored_file.size. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Types that are safe to render inline; everything else is always served as a download. */
export const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']);

/**
 * The media type of a stored file, from its own bytes (the file-type package, the one Nest's own file
 * validation uses). The declared type is only honoured for a few plain-data types, never to mark a file as an
 * image, HTML or script. Reads only as much of the stream as detection needs, then closes it.
 */
export async function detectMediaType(content: Readable, declared: string): Promise<string> {
  try {
    const found = await fileTypeFromStream(content);
    if (found) return found.mime;
  } finally {
    content.destroy();
  }
  const type = declared.split(';')[0]?.trim().toLowerCase() ?? '';
  return ['text/plain', 'text/csv', 'application/json'].includes(type) ? type : 'application/octet-stream';
}

/** A filename safe to store and send in a header: no path, no control characters, bounded length. */
export function safeFilename(value: string): string {
  const name = value.replaceAll('\\', '/').split('/').at(-1) ?? '';
  const cleaned = [...name]
    .filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
    .join('')
    .trim()
    .slice(0, 180);
  return cleaned === '' || /^\.+$/.test(cleaned) ? 'attachment' : cleaned;
}
