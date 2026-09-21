'use client';

import { EmptyState, LoadingState } from '@/components/shared';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChatSurface } from '@/components/Chat/ChatSurface';
import { fetchChatHistory } from '@/components/Chat/fetchChatHistory';

interface EveChatRow {
  sessionId: string;
  title: string | null;
  continuationToken: string | null;
  streamIndex: number | null;
}

export default function ChatPage() {
  const params = useParams();
  const sessionId = params.chatId as string;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['chat-session', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const res = await fetch(`/api/chats/${sessionId}`);
      if (!res.ok) throw new Error('not found');
      const row = (await res.json()) as EveChatRow;
      const history = await fetchChatHistory(sessionId);
      return { row, history };
    },
  });

  if (isError)
    return (
      <EmptyState
        title="Session not found"
        description="It may have been deleted, or you may not have access to it."
      />
    );
  if (isLoading || !data) return <LoadingState message="Loading chat…" />;

  return (
    <ChatSurface
      resume
      initialSession={{
        sessionId,
        streamIndex: data.history.streamIndex,
        ...(data.row.continuationToken
          ? { continuationToken: data.row.continuationToken }
          : {}),
      }}
      initialEvents={data.history.events}
    />
  );
}
