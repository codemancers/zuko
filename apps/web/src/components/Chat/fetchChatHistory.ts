import type { HandleMessageStreamEvent } from 'eve/client';

/**
 * Replay a past eve session's event log so `/chat/:id` can render the
 * conversation on reopen.
 *
 * Reads the stream incrementally — historical events arrive in a burst, then
 * the stream goes quiet waiting for new turns. We stop once no bytes arrive
 * for IDLE_MS. The collected events feed `useEveAgent`'s `initialEvents`
 * (reduced into `data.messages`), and `streamIndex` positions the cursor to
 * continue after them.
 */
const IDLE_MS = 1500;

export interface ChatHistory {
  events: HandleMessageStreamEvent[];
  streamIndex: number;
}

export async function fetchChatHistory(
  sessionId: string,
): Promise<ChatHistory> {
  const res = await fetch(
    `/api/eve/v1/session/${encodeURIComponent(sessionId)}/stream?startIndex=0`,
  );
  if (!res.ok || !res.body) return { events: [], streamIndex: 0 };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events: HandleMessageStreamEvent[] = [];
  let buffer = '';

  try {
    for (;;) {
      const result = await Promise.race([
        reader.read(),
        new Promise<'idle'>((resolve) =>
          setTimeout(() => resolve('idle'), IDLE_MS),
        ),
      ]);
      if (result === 'idle') break;
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim())
          events.push(JSON.parse(line) as HandleMessageStreamEvent);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return { events, streamIndex: events.length };
}
