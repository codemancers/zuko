'use client';

import { useEveAgent } from 'eve/react';
import type { EveMessage, EveMessagePart } from 'eve/react';
import {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  MessageResponse,
  TooltipProvider,
} from '@zuko/ui-kit';
import { type ChatEntity } from '@/components/Chat/ChatContextManager';
import { ChatInput } from '@/components/Chat/ChatInput';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from '@/components/Chat/Tool';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useInvalidateChats } from '@/hooks/use-chats';
import { contactsApi } from '@/lib/api/contacts';
import { companiesApi } from '@/lib/api/companies';
import { dealsApi } from '@/lib/api/deals';
import { CHAT_ENTITY_TYPE_LABEL } from '@/lib/constants';

export default function ChatPage() {
  const params = useParams();
  const chatId = params.chatId as string;
  const invalidateChats = useInvalidateChats();

  const [historyMessages, setHistoryMessages] = useState<EveMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [firstMessageSent, setFirstMessageSent] = useState(false);
  const [initialContext, setInitialContext] = useState<ChatEntity[]>([]);
  const [_chatContext, setChatContext] = useState<ChatEntity[]>([]);

  const persistedCountRef = useRef(0);

  const agent = useEveAgent({
    onFinish: useCallback(
      (snapshot: { data: { messages: readonly EveMessage[] } }) => {
        const msgs = snapshot.data.messages;
        if (msgs.length <= persistedCountRef.current) return;

        const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
        const lastAssistant = [...msgs]
          .reverse()
          .find((m) => m.role === 'assistant');
        if (!lastUser || !lastAssistant) return;

        const userText = lastUser.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { type: 'text'; text: string }).text)
          .join('');
        const assistantText = lastAssistant.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { type: 'text'; text: string }).text)
          .join('');

        persistedCountRef.current = msgs.length;

        if (userText.trim() && assistantText.trim()) {
          fetch(`/api/proxy/api/chats/${chatId}/messages`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              userMessage: userText,
              assistantMessage: assistantText,
            }),
          }).catch(() => {});
        }
      },
      [chatId],
    ),
  });

  const isBusy = agent.status === 'submitted' || agent.status === 'streaming';
  const liveMessages = agent.data.messages;
  const allMessages = [...historyMessages, ...liveMessages];
  const hasMessages = allMessages.length > 0;

  const handleFirstMessage = useCallback(
    async (data: string) => {
      localStorage.removeItem(`chat-${chatId}-firstMessage`);
      try {
        let messageText: string;
        let contextEntities: Array<{ type: string; id: number }> = [];

        try {
          const parsed = JSON.parse(data) as {
            text: string;
            contextEntities?: Array<{ type: string; id: number }>;
          };
          messageText = parsed.text;
          contextEntities = parsed.contextEntities ?? [];
        } catch {
          messageText = data;
        }

        if (contextEntities.length > 0) {
          const hydrated: ChatEntity[] = await Promise.all(
            contextEntities.map(async (ref): Promise<ChatEntity> => {
              const type = ref.type as 'contact' | 'company' | 'deal';
              try {
                if (type === 'contact') {
                  const c = await contactsApi.getContact(ref.id);
                  return {
                    type: 'contact',
                    id: ref.id,
                    name: c.name,
                    metadata: { type: 'contact', entityId: ref.id },
                  };
                }
                if (type === 'company') {
                  const c = await companiesApi.getCompany(ref.id);
                  return {
                    type: 'company',
                    id: ref.id,
                    name: c.companyName,
                    metadata: { type: 'company', entityId: ref.id },
                  };
                }
                const d = await dealsApi.getDeal(ref.id);
                return {
                  type: 'deal',
                  id: ref.id,
                  name: d.title,
                  metadata: { type: 'deal', entityId: ref.id },
                };
              } catch {
                return {
                  type,
                  id: ref.id,
                  name: CHAT_ENTITY_TYPE_LABEL[type],
                  metadata: { type, entityId: ref.id },
                };
              }
            }),
          );
          setInitialContext(hydrated);
        }

        const contextPrefix = contextEntities.length
          ? `Context:\n${contextEntities.map((e) => `- ${e.type} id=${e.id}`).join('\n')}\n\n`
          : '';

        await agent.send({ message: contextPrefix + messageText });
        setFirstMessageSent(true);
        setMessagesLoaded(true);
        setTimeout(() => invalidateChats(), 2000);
      } catch (error) {
        console.error('[ChatPage] Error parsing first message:', error);
        setMessagesLoaded(true);
      }
    },
    [chatId, agent, invalidateChats],
  );

  const loadMessageHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/proxy/api/chats/${chatId}/messages`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as {
          messages?: Array<{
            id?: string;
            role: string;
            content?: string;
            parts?: EveMessagePart[];
          }>;
          contextEntities?: Array<{ type: string; id: number; name: string }>;
        };
        const rows = data.messages ?? [];
        const contextRefs = data.contextEntities ?? [];

        const formatted: EveMessage[] = rows.map((msg, index) => ({
          id: msg.id ?? `msg-${index}`,
          role: msg.role as 'user' | 'assistant',
          parts: Array.isArray(msg.parts)
            ? (msg.parts as EveMessagePart[])
            : [{ type: 'text' as const, text: msg.content ?? '' }],
          metadata: undefined,
        }));

        if (formatted.length > 0) setHistoryMessages(formatted);

        const hydratedEntities: ChatEntity[] = contextRefs.map((ref) => ({
          type: ref.type as 'contact' | 'company' | 'deal',
          id: ref.id,
          name: ref.name,
          metadata: { type: ref.type, entityId: ref.id },
        }));
        if (hydratedEntities.length > 0) setInitialContext(hydratedEntities);
      }
    } catch (error) {
      console.error('[ChatPage] Error loading messages:', error);
    } finally {
      setMessagesLoaded(true);
    }
  }, [chatId]);

  useEffect(() => {
    if (!messagesLoaded && !firstMessageSent && chatId) {
      const firstMessageData = localStorage.getItem(
        `chat-${chatId}-firstMessage`,
      );
      if (firstMessageData) {
        handleFirstMessage(firstMessageData);
      } else {
        loadMessageHistory();
      }
    }
  }, [
    chatId,
    messagesLoaded,
    firstMessageSent,
    handleFirstMessage,
    loadMessageHistory,
  ]);

  const handleSubmitMessage = async (msg: {
    text: string;
    files?: unknown[];
    metadata?: { contextEntities?: Array<{ type: string; id: number }> };
  }) => {
    if (!msg.text.trim() || isBusy) return;

    const contextEntities = msg.metadata?.contextEntities ?? [];
    const contextPrefix = contextEntities.length
      ? `Context:\n${contextEntities.map((e) => `- ${e.type} id=${e.id}`).join('\n')}\n\n`
      : '';

    const isFirst = historyMessages.length === 0 && liveMessages.length === 0;
    await agent.send({ message: contextPrefix + msg.text });
    if (isFirst) setTimeout(() => invalidateChats(), 2000);
  };

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900">
        {hasMessages ? (
          <>
            <div className="flex-1 overflow-hidden">
              <Conversation className="h-full">
                <ConversationContent className="mx-auto max-w-3xl">
                  {allMessages.map((message, index) => (
                    <EveMessageView
                      key={message.id ?? String(index)}
                      message={message}
                      isStreaming={
                        agent.status === 'streaming' &&
                        index === allMessages.length - 1
                      }
                    />
                  ))}
                </ConversationContent>
              </Conversation>
            </div>
            <div className="shrink-0 bg-zinc-50 py-4 dark:bg-zinc-900">
              <div className="mx-auto w-full max-w-3xl px-4">
                <ChatInput
                  onSubmit={handleSubmitMessage}
                  placeholder="Ask anything..."
                  initialContext={initialContext}
                  onContextChange={setChatContext}
                  status={agent.status}
                  onStop={agent.stop}
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
                onSubmit={handleSubmitMessage}
                placeholder="Ask anything..."
                initialContext={initialContext}
                onContextChange={setChatContext}
                status={agent.status}
                onStop={agent.stop}
              />
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function EveMessageView({
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
          <EvePartView
            key={`${part.type}-${i}`}
            part={part}
            showCaret={
              isStreaming && message.role === 'assistant' && i === lastTextIndex
            }
          />
        ))}
      </MessageContent>
    </Message>
  );
}

function EvePartView({
  part,
  showCaret,
}: {
  part: EveMessagePart;
  showCaret: boolean;
}) {
  switch (part.type) {
    case 'step-start':
      return null;
    case 'text':
      return (
        <MessageResponse>
          {(part as { type: 'text'; text: string }).text +
            (showCaret ? '▋' : '')}
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
          <ToolHeader
            type="dynamic-tool"
            state={sdkState}
            toolName={toolPart.toolName}
          />
          <ToolContent>
            <ToolOutput
              output={toolPart.output}
              errorText={toolPart.errorText}
            />
          </ToolContent>
        </Tool>
      );
    }
    default:
      return null;
  }
}
