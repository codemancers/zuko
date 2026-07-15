'use client';

import { useCallback, useRef, useState } from 'react';
import { useEveAgent } from 'eve/react';
import type { EveMessage, EveMessagePart, HandleMessageStreamEvent } from 'eve/react';
import {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  MessageResponse,
  TooltipProvider,
} from '@zuko/ui-kit';
import { ChatInput } from './ChatInput';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from './Tool';

interface ChatSurfaceProps {
  /** True on /chat/:id resume — suppresses row creation. */
  resume?: boolean;
  initialSession?: {
    sessionId: string;
    streamIndex: number;
    continuationToken?: string;
  };
  initialEvents?: readonly HandleMessageStreamEvent[];
}

/**
 * Eve chat surface shared by /chat (new) and /chat/:id (resume). Owns
 * useEveAgent. On the FIRST session of a new chat it records a thin EveChat row
 * (POST /api/chats) and swaps the URL to /chat/:sessionId via
 * history.replaceState — no Next remount, live turn uninterrupted.
 */
export function ChatSurface({ resume, initialSession, initialEvents }: ChatSurfaceProps) {
  const navigatedRef = useRef<boolean>(!!resume);
  const firstMessageRef = useRef<string>('');
  const lastTokenRef = useRef<string | undefined>(initialSession?.continuationToken);

  const persist = useCallback(
    async (
      s: { sessionId?: string; continuationToken?: string; streamIndex: number },
      navigate: boolean,
    ) => {
      try {
        await fetch('/api/chats', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId: s.sessionId,
            title: firstMessageRef.current.slice(0, 80),
            continuationToken: s.continuationToken,
            streamIndex: s.streamIndex,
          }),
        });
        if (navigate)
          window.history.replaceState(null, '', `/chat/${s.sessionId}`);
      } catch {
        if (navigate) navigatedRef.current = false;
        lastTokenRef.current = undefined;
      }
    },
    [],
  );

  const { data, status, error, send } = useEveAgent({
    host: '/api',
    ...(initialSession ? { initialSession } : {}),
    ...(initialEvents ? { initialEvents } : {}),
    onSessionChange: (s) => {
      if (!s.sessionId) return;
      const firstTime = !navigatedRef.current;
      const tokenChanged =
        !!s.continuationToken && s.continuationToken !== lastTokenRef.current;
      if (!firstTime && !tokenChanged) return;
      if (firstTime) navigatedRef.current = true;
      if (s.continuationToken) lastTokenRef.current = s.continuationToken;
      void persist(s, firstTime);
    },
  });

  const [input, setInput] = useState('');
  const working = status === 'submitted' || status === 'streaming';
  const hasMessages = data.messages.length > 0;

  async function handleSubmit(msg: { text: string }) {
    const message = msg.text.trim();
    if (!message || working) return;
    if (!firstMessageRef.current) firstMessageRef.current = message;
    await send({ message }).catch(() => {});
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900">
        {hasMessages ? (
          <>
            <div className="flex-1 overflow-hidden">
              <Conversation className="h-full">
                <ConversationContent className="mx-auto max-w-3xl">
                  {data.messages.map((message, index) => (
                    <ChatMessageView
                      key={message.id ?? String(index)}
                      message={message}
                      isStreaming={
                        status === 'streaming' && index === data.messages.length - 1
                      }
                    />
                  ))}
                </ConversationContent>
              </Conversation>
            </div>
            <div className="shrink-0 bg-zinc-50 py-4 dark:bg-zinc-900">
              <div className="mx-auto w-full max-w-3xl px-4">
                <ChatInput
                  onSubmit={handleSubmit}
                  placeholder="Ask anything..."
                  status={status}
                  onStop={undefined}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="mb-12 text-center">
              <h2 className="mb-2 text-xl font-medium text-zinc-950 dark:text-white">
                Start a conversation
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Ask me anything to get started
              </p>
            </div>
            <div className="w-full max-w-3xl">
              <ChatInput
                onSubmit={handleSubmit}
                placeholder="Ask anything..."
                status={status}
                onStop={undefined}
              />
            </div>
          </div>
        )}

        {status === 'error' && (
          <p className="text-destructive shrink-0 px-4 pb-2 text-sm" role="alert">
            {error?.message ?? 'The agent failed to complete this turn.'}
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}

function ChatMessageView({
  message,
  isStreaming,
}: {
  message: EveMessage;
  isStreaming: boolean;
}) {
  const lastTextIndex = message.parts.reduce(
    (last, part, i) => (part.type === 'text' ? i : last),
    -1,
  );
  return (
    <Message from={message.role}>
      <MessageContent>
        {message.parts.map((part, i) => (
          <ChatPartView
            key={`${part.type}-${i}`}
            part={part}
            showCaret={isStreaming && message.role === 'assistant' && i === lastTextIndex}
          />
        ))}
      </MessageContent>
    </Message>
  );
}

function ChatPartView({ part, showCaret }: { part: EveMessagePart; showCaret: boolean }) {
  switch (part.type) {
    case 'step-start':
      return null;
    case 'text':
      return (
        <MessageResponse>
          {(part as { type: 'text'; text: string }).text + (showCaret ? '▋' : '')}
        </MessageResponse>
      );
    case 'dynamic-tool': {
      const toolPart = part as {
        type: 'dynamic-tool';
        toolName: string;
        state: string;
        input?: unknown;
        output?: string;
        errorText?: string;
      };
      const sdkState = toolPart.errorText
        ? 'output-error'
        : toolPart.output
          ? 'output-available'
          : 'input-streaming';
      return (
        <Tool defaultOpen={false}>
          <ToolHeader type="dynamic-tool" state={sdkState} toolName={toolPart.toolName} />
          <ToolContent>
            <ToolOutput output={toolPart.output} errorText={toolPart.errorText} />
          </ToolContent>
        </Tool>
      );
    }
    default:
      return null;
  }
}
