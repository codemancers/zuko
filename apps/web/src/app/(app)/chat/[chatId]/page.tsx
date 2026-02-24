'use client';

import { useChat } from '@ai-sdk/react';
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
import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useInvalidateChats } from '@/hooks/use-chats';

export default function ChatPage() {
  const params = useParams();
  const chatId = params.chatId as string;

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    // Using default '/api/chat' endpoint
    // chatId is extracted from Referer header in /api/chat route
  });

  const invalidateChats = useInvalidateChats();
  const [firstMessageSent, setFirstMessageSent] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  const hasMessages = messages.length > 0;

  // Chat context state
  const [_chatContext, setChatContext] = useState<ChatEntity[]>([]);
  const [initialContext, setInitialContext] = useState<ChatEntity[]>([]);

  // Helper: Handle first message from localStorage (new chat)
  const handleFirstMessage = useCallback((data: string) => {
    console.log('[ChatPage] New chat detected, sending first message immediately');

    // Clear from localStorage
    localStorage.removeItem(`chat-${chatId}-firstMessage`);

    try {
      // Parse the stored data
      let messageText: string;
      let contextEntities: Array<{ type: string; id: number }> = [];

      try {
        const parsed = JSON.parse(data);
        messageText = parsed.text;
        contextEntities = parsed.contextEntities || [];
      } catch {
        // Fallback for old format (plain text)
        messageText = data;
      }

      // Set context entities for UI chips
      if (contextEntities.length > 0) {
        const entities: ChatEntity[] = contextEntities.map(ref => ({
          type: ref.type as 'contact' | 'company',
          id: ref.id,
          name: `${ref.type}-${ref.id}`, // Placeholder name
          metadata: { type: ref.type, entityId: ref.id },
        }));
        setInitialContext(entities);
      }

      // Send message immediately (no wait!)
      sendMessage({
        text: messageText,
        metadata: contextEntities.length > 0 ? { contextEntities } : undefined,
      });

      // Mark as loaded (skipped history fetch)
      setFirstMessageSent(true);
      setMessagesLoaded(true);

      // Invalidate chats query to refresh sidebar with new title
      setTimeout(() => {
        invalidateChats();
      }, 2000);
    } catch (error) {
      console.error('[ChatPage] Error parsing first message data:', error);
      setMessagesLoaded(true); // Mark as loaded even on error
    }
  }, [chatId, sendMessage, invalidateChats]);

  // Helper: Load message history from backend (existing chat)
  const loadMessageHistory = useCallback(async () => {
    console.log('[ChatPage] Loading message history for existing chat');

    try {
      const response = await fetch(`/api/proxy/api/chats/${chatId}/messages`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const historyMessages = data.messages || [];
        const contextRefs = data.contextEntities || [];

        // Convert to AI SDK v6 message format with parts array
        const formattedMessages = historyMessages.map((msg: any, index: number) => ({
          id: `msg-${index}`,
          role: msg.role,
          parts: [
            {
              type: 'text',
              text: msg.content,
            },
          ],
        }));

        if (formattedMessages.length > 0) {
          setMessages(formattedMessages);
        }

        // Hydrate context entities from backend response (includes names)
        const hydratedEntities: ChatEntity[] = contextRefs.map((ref: { type: string; id: number; name: string }) => ({
          type: ref.type as 'contact' | 'company',
          id: ref.id,
          name: ref.name, // Use actual name from backend
          metadata: { type: ref.type, entityId: ref.id },
        }));

        if (hydratedEntities.length > 0) {
          setInitialContext(hydratedEntities);
        }
      }
    } catch (error) {
      console.error('[ChatPage] Error loading messages:', error);
    } finally {
      setMessagesLoaded(true);
    }
  }, [chatId, setMessages]);

  // Smart initialization: Check localStorage first, then load history if needed
  // This eliminates the gap where first message disappears during navigation
  useEffect(() => {
    if (!messagesLoaded && !firstMessageSent && chatId) {
      // Step 1: Check if this is a new chat (has first message in localStorage)
      const firstMessageData = localStorage.getItem(`chat-${chatId}-firstMessage`);

      if (firstMessageData) {
        // NEW CHAT PATH: Send first message immediately, skip history fetch
        handleFirstMessage(firstMessageData);
      } else {
        // EXISTING CHAT PATH: Load message history from backend
        loadMessageHistory();
      }
    }
  }, [chatId, messagesLoaded, firstMessageSent, handleFirstMessage, loadMessageHistory]);

  const handleSubmitMessage = async (msg: { text: string; files?: any[]; metadata?: any }) => {
    if (!msg.text.trim()) {
      return;
    }

    try {
      console.log('[ChatPage] handleSubmitMessage called with:', msg);

      const isFirstMessage = messages.length === 0;
      await sendMessage({
        text: msg.text,
        files: msg.files,
        metadata: msg.metadata, // Pass through metadata (includes contextEntities from ChatInput)
      });

      // If this was the first message, invalidate chats query after a short delay
      // to allow the backend to generate the title
      if (isFirstMessage) {
        setTimeout(() => {
          invalidateChats();
        }, 2000); // 2 second delay for title generation
      }
    } catch (error) {
      console.error('[ChatPage] Error in handleSubmitMessage:', error);
      throw error; // Re-throw so PromptInput doesn't clear the input on error
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900">
        {hasMessages ? (
          <>
            {/* Messages Area - with scrolling, constrained width */}
            <div className="flex-1 overflow-hidden">
              <Conversation className="h-full">
                <ConversationContent className="mx-auto max-w-3xl">
                  {messages.map((message) => {
                    // Extract text from parts array (AI SDK v6 format)
                    const content = message.parts
                      ?.filter((part: any) => part.type === 'text')
                      .map((part: any) => part.text)
                      .join('') || '';

                    return (
                      <Message key={message.id} from={message.role}>
                        <MessageContent>
                          <MessageResponse>{content}</MessageResponse>
                        </MessageContent>
                      </Message>
                    );
                  })}
                </ConversationContent>
              </Conversation>
            </div>

            {/* Input Area - pinned to bottom */}
            <div className="shrink-0 bg-zinc-50 py-4 dark:bg-zinc-900">
              <div className="mx-auto w-full max-w-3xl px-4">
                <ChatInput
                  onSubmit={handleSubmitMessage}
                  placeholder="Ask anything..."
                  initialContext={initialContext}
                  onContextChange={setChatContext}
                  status={status}
                  onStop={stop}
                />
              </div>
            </div>
          </>
        ) : (
          /* Empty state - input centered */
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
                status={status}
                onStop={stop}
              />
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
