/**
 * New chat page - uses unified ChatInput component
 */

'use client';

import { TooltipProvider } from '@zuko/ui-kit';
import { type ChatEntity } from '@/components/Chat/ChatContextManager';
import { ChatInput } from '@/components/Chat/ChatInput';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewChatPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [_chatContext, setChatContext] = useState<ChatEntity[]>([]);

  const handleSubmitMessage = async (msg: { text: string; files?: any[]; metadata?: any }) => {
    if (!msg.text.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create the chat
      const createResponse = await fetch('/api/proxy/api/chats', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create chat');
      }

      const chat = await createResponse.json();
      const chatId = chat.id;

      // Step 2: Store the first message AND context entities in localStorage for the chat page to pick up
      const firstMessageData = {
        text: msg.text,
        contextEntities: msg.metadata?.contextEntities || [],
      };
      localStorage.setItem(`chat-${chatId}-firstMessage`, JSON.stringify(firstMessageData));

      // Step 3: Redirect to the new chat
      router.replace(`/chat/${chatId}`);
    } catch (error) {
      console.error('[NewChatPage] Error creating chat:', error);
      setIsSubmitting(false);
      throw error; // Re-throw so PromptInput doesn't clear the input on error
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="mb-12 text-center">
          <h2 className="mb-2 text-xl font-medium text-zinc-950 dark:text-white">
            Start a conversation
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ask me anything to get started
          </p>
        </div>
        <div className="w-full max-w-3xl px-4">
          <ChatInput
            onSubmit={handleSubmitMessage}
            onContextChange={setChatContext}
            disabled={isSubmitting}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
