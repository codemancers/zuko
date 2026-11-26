import { fileProblems } from './files';

/** A message with file links is a few hundred bytes; anything near this size is carrying content. */
export const CHAT_BODY_LIMIT = 1024 * 1024;

export const INLINE_FILE_MESSAGE =
  'Files must be uploaded to Zuko first and sent by their link, never as inline content';

/**
 * What is wrong with the file parts of a chat message request, read before it reaches the channel.
 * The channel's own `onMessage` also refuses these, but eve reports any error there as a generic 500;
 * refusing here gives the caller a 403 that says why. Anything that is not a JSON object is left to eve.
 */
export async function requestFileProblems(request: Request): Promise<string[]> {
  if (Number(request.headers.get('content-length')) > CHAT_BODY_LIMIT) return [INLINE_FILE_MESSAGE];
  const reader = request.clone().body?.getReader();
  if (!reader) return [];
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > CHAT_BODY_LIMIT) {
        void reader.cancel().catch(() => undefined);
        return [INLINE_FILE_MESSAGE];
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    const body: unknown = JSON.parse(chunks.join('') + decoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
    return fileProblems((body as { message?: unknown }).message);
  } catch {
    return [];
  } finally {
    reader.releaseLock();
  }
}
