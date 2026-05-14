import { toUIMessageStream } from '@ai-sdk/langchain';
import type { UIMessageChunk } from 'ai';

/**
 * Converts a deepagents / LangGraph stream into an AI-SDK UIMessageChunk
 * ReadableStream.
 *
 * `suppressStart` drops the converter's first `start` chunk — used when the
 * controller has already emitted its own `start` (with a stable assistantId)
 * before the agent loop began. Without it the client sees two start events
 * with different ids and the active turn ref gets re-pointed mid-turn.
 */
export function convertChatStreamToUiMessageStream(
  graphStream: AsyncIterable<unknown>,
  options?: { suppressStart?: boolean },
): ReadableStream<UIMessageChunk> {
  const raw = toUIMessageStream(
    graphStream as any,
  ) as ReadableStream<UIMessageChunk>;

  if (!options?.suppressStart) return raw;

  let dropped = false;
  return raw.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (!dropped && chunk.type === 'start') {
          dropped = true;
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}
