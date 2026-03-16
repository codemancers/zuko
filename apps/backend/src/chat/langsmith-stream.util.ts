import { Readable } from "node:stream";

/**
 * Transform SSE stream from LangSmith / LangGraph agent server
 * into a LangChain-style stream compatible with toUIMessageStream.
 *
 * Node Readable version adapted from an existing browser implementation.
 */
export async function* transformSSEToLangChainStreamFromNode(
  nodeStream: Readable,
): AsyncGenerator<[string, unknown]> {
  const decoder = new TextDecoder();
  let buffer = "";
  const lastToolCallArgs: Map<string, string> = new Map();
  let finalAIMessage: Record<string, unknown> | null = null;
  let lastAIContent = "";

  const processSSEMessage = function* (
    message: string,
  ): Generator<[string, unknown]> {
    const normalized = message.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    let currentEvent = "";
    const dataLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (trimmed.startsWith("event:")) {
        currentEvent = trimmed.slice(6).trim();
      } else if (trimmed.startsWith("data:")) {
        dataLines.push(trimmed.slice(5));
      }
    }

    if (!currentEvent || dataLines.length === 0) return;

    const dataStr = dataLines.join("\n").trim();
    try {
      const parsedData = JSON.parse(dataStr);

      if (
        currentEvent === "messages/partial" &&
        Array.isArray(parsedData) &&
        parsedData.length > 0
      ) {
        const msg = parsedData[0] as
          | {
              tool_call_chunks?: Array<{
                id?: string;
                index?: number;
                args?: string;
                name?: string;
              }>;
              type?: string;
              content?: unknown;
            }
          | undefined;

        // Stream tool call deltas
        if (msg?.tool_call_chunks && msg.tool_call_chunks.length > 0) {
          const deltaToolCallChunks = [];

          for (const chunk of msg.tool_call_chunks) {
            const toolCallId =
              chunk.id ?? `tool_${chunk.index ?? Date.now()}`;
            const currentArgs = chunk.args ?? "";
            const lastArgs = lastToolCallArgs.get(toolCallId) ?? "";

            let argsDelta = "";
            if (currentArgs.length > lastArgs.length) {
              argsDelta = currentArgs.slice(lastArgs.length);
              lastToolCallArgs.set(toolCallId, currentArgs);
            }

            const isNewToolCall =
              !lastToolCallArgs.has(toolCallId) || lastArgs === "";
            if (isNewToolCall || argsDelta) {
              deltaToolCallChunks.push({
                ...chunk,
                args: argsDelta,
                name: isNewToolCall ? chunk.name : undefined,
              });

              if (isNewToolCall && !lastToolCallArgs.has(toolCallId)) {
                lastToolCallArgs.set(toolCallId, currentArgs);
              }
            }
          }

          if (deltaToolCallChunks.length > 0) {
            const deltaMsg = {
              ...(msg as Record<string, unknown>),
              tool_call_chunks: deltaToolCallChunks,
            };
            yield ["messages", [deltaMsg, { langgraph_node: "agent" }]];
          }
        } else if (msg?.type === "tool") {
          yield ["messages", [msg, { langgraph_node: "tools" }]];
        } else if (
          msg?.type === "ai" &&
          typeof msg.content === "string" &&
          msg.content.length > 0
        ) {
          // LangSmith sends the full accumulated content; convert to a delta
          // so the UI doesn't see the whole string repeated each time.
          const full = msg.content;
          let delta = full;
          if (full.startsWith(lastAIContent)) {
            delta = full.slice(lastAIContent.length);
          }
          if (delta.length > 0) {
            lastAIContent = full;
            const deltaMsg = {
              ...(msg as Record<string, unknown>),
              content: delta,
            };
            yield ["messages", [deltaMsg, { langgraph_node: "agent" }]];
          }
        }
      } else if (
        currentEvent === "messages/complete" &&
        Array.isArray(parsedData) &&
        parsedData.length > 0
      ) {
        const msg = parsedData[0] as
          | (Record<string, unknown> & {
              type?: string;
              content?: unknown;
            })
          | undefined;
        if (
          msg?.type === "ai" &&
          typeof msg.content === "string" &&
          msg.content.length > 0
        ) {
          finalAIMessage = msg;
        } else if (msg?.type === "tool") {
          yield ["messages", [msg, { langgraph_node: "tools" }]];
        }
        lastToolCallArgs.clear();
      } else if (currentEvent === "values") {
        yield ["values", parsedData];
        if (
          parsedData?.messages &&
          Array.isArray(parsedData.messages) &&
          parsedData.messages.length > 0
        ) {
          const lastMsg = parsedData.messages[
            parsedData.messages.length - 1
          ] as
            | (Record<string, unknown> & {
                type?: string;
                content?: unknown;
              })
            | undefined;
          if (lastMsg?.type === "ai" && lastMsg.content) {
            finalAIMessage = lastMsg;
          }
        }
      } else {
        yield [currentEvent, parsedData];
      }
    } catch {
      // eslint-disable-next-line no-console
      console.error("Failed to parse SSE data:", dataStr.substring(0, 200));
    }
  };

  for await (const chunk of nodeStream) {
    buffer += decoder.decode(
      typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer),
      { stream: true },
    );

    const normalizedBuffer = buffer.replace(/\r\n/g, "\n");
    const messages = normalizedBuffer.split("\n\n");
    buffer = messages.pop() ?? "";

    for (const message of messages) {
      if (!message.trim()) continue;
      yield* processSSEMessage(message);
    }
  }

  if (buffer.trim()) {
    const normalizedBuffer = buffer.replace(/\r\n/g, "\n");
    for (const message of normalizedBuffer.split("\n\n")) {
      if (!message.trim()) continue;
      yield* processSSEMessage(message);
    }
  }

  const msg = finalAIMessage as
    | (Record<string, unknown> & { content?: unknown })
    | null;
  // Only synthesize chunks if we did NOT already stream incremental AI content
  if (!lastAIContent && msg?.content && typeof msg.content === "string") {
    const content = msg.content;
    const chunkSize = 10;
    for (let i = 0; i < content.length; i += chunkSize) {
      const textChunk = content.slice(i, i + chunkSize);
      const chunkMsg = { ...msg, content: textChunk };
      yield ["messages", [chunkMsg, { langgraph_node: "agent" }]];
    }
  }
}

