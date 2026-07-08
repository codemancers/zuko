import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

// Module-level session store: chatId → { wrunId, continuationToken }
// Survives across requests within the same Next.js server process.
const eveSessions = new Map<
  string,
  { wrunId: string; continuationToken: string }
>();

const AI_AGENT_URL = process.env.AI_AGENT_URL ?? 'http://localhost:3002';
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

type EvePart = { type: string; text?: string };
type EveMessage = {
  role: string;
  parts?: EvePart[];
  content?: string;
  metadata?: unknown;
};

function extractText(messages: EveMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  if (!last) return '';
  return (
    last.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text ?? '')
      .join('') ??
    (last as unknown as { content: string }).content ??
    ''
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages = [], chatId } = body as {
      messages: EveMessage[];
      chatId?: string;
    };

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'chatId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userText = extractText(messages);

    // contextEntities come from the last user message's metadata
    const lastMsg = [...messages].reverse().find((m) => m.role === 'user');
    const contextEntities =
      (
        lastMsg?.metadata as {
          contextEntities?: Array<{ type: string; id: number }>;
        }
      )?.contextEntities ?? [];

    const contextPrefix = contextEntities.length
      ? `Context:\n${contextEntities.map((e) => `- ${e.type} id=${e.id}`).join('\n')}\n\n`
      : '';
    const messageText = contextPrefix + userText;

    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    // Start new session or continue existing one
    const existing = eveSessions.get(chatId);
    const eveUrl = existing
      ? `${AI_AGENT_URL}/eve/v1/session/${existing.wrunId}`
      : `${AI_AGENT_URL}/eve/v1/session`;
    const eveBody = existing
      ? { continuationToken: existing.continuationToken, message: messageText }
      : { message: messageText };

    const eveRes = await fetch(eveUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify(eveBody),
    });

    if (!eveRes.ok) {
      const err = await eveRes.text();
      return new Response(err, { status: eveRes.status });
    }

    const { sessionId: wrunId, continuationToken } = (await eveRes.json()) as {
      sessionId: string;
      continuationToken: string;
    };
    eveSessions.set(chatId, { wrunId, continuationToken });

    const streamRes = await fetch(
      `${AI_AGENT_URL}/eve/v1/session/${wrunId}/stream`,
      {
        headers: { cookie: cookieHeader },
      },
    );

    if (!streamRes.ok || !streamRes.body) {
      return new Response('Stream unavailable', { status: 502 });
    }

    let assistantText = '';
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const reader = streamRes.body!.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line) as {
                  type: string;
                  data: Record<string, unknown>;
                };
                if (event.type === 'message.appended') {
                  const delta = (event.data.messageDelta as string) ?? '';
                  assistantText += delta;
                  controller.enqueue(
                    encoder.encode(`data: 0:${JSON.stringify(delta)}\n\n`),
                  );
                } else if (event.type === 'message.completed') {
                  const usage =
                    (event.data.usage as Record<string, number>) ?? {};
                  const finish = JSON.stringify({
                    finishReason: 'stop',
                    usage: {
                      promptTokens: usage.inputTokens ?? 0,
                      completionTokens: usage.outputTokens ?? 0,
                    },
                    isContinued: false,
                  });
                  controller.enqueue(encoder.encode(`data: e:${finish}\n\n`));
                  controller.enqueue(
                    encoder.encode(`data: d:{"finishReason":"stop"}\n\n`),
                  );
                }
              } catch {
                // skip malformed NDJSON lines
              }
            }
          }
        } finally {
          reader.releaseLock();
          controller.close();

          // Persist exchange to backend (best-effort)
          if (chatId && userText.trim() && assistantText.trim()) {
            fetch(`${BACKEND_URL}/api/chats/${chatId}/messages`, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                cookie: cookieHeader,
              },
              body: JSON.stringify({
                userMessage: userText,
                assistantMessage: assistantText,
              }),
            }).catch(() => {});
          }
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[/api/chat] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
