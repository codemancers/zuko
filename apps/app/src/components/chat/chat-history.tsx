'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { Shell } from '@/components/dashboard/shell';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient, useSession } from '@/lib/auth-client';
import { readChatHistory, removeChatHistory, type ChatHistoryItem } from '@/lib/eve-history';

function ChatHistoryList({ scope, organizationName }: { scope: string; organizationName: string }) {
  const [history, setHistory] = useState<ChatHistoryItem[]>(() => readChatHistory(scope));
  return (
    <Shell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your chats</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Conversations in {organizationName} on this browser.
          </p>
        </div>
        <Button asChild>
          <Link href="/chat/new">
            <Plus aria-hidden />
            New chat
          </Link>
        </Button>
      </div>
      {history.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <MessageSquare className="mb-2 size-8 text-muted-foreground" aria-hidden />
            <h2 className="font-semibold">No conversations yet</h2>
            <CardDescription>Start a chat to search or work with your CRM.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {history.map((chat) => (
            <li key={chat.sessionId} className="flex items-center gap-3 p-3">
              <Link
                href={`/chat/s/${encodeURIComponent(chat.sessionId)}`}
                className="min-w-0 flex-1 rounded-lg px-2 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="block truncate text-sm font-medium">{chat.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {new Date(chat.updatedAt).toLocaleString()}
                </span>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${chat.title} from history`}
                onClick={() => {
                  removeChatHistory(scope, chat.sessionId);
                  setHistory(readChatHistory(scope));
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

export function ChatHistory() {
  const { data: session, isPending } = useSession();
  const { data: organization, isPending: organizationPending } = authClient.useActiveOrganization();

  if (isPending || organizationPending || !session)
    return (
      <Shell>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
      </Shell>
    );

  if (!organization) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold">Choose an organization</h1>
            <CardDescription>Chat history is kept separate for each organization.</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  const scope = `${session.user.id}:${organization.id}`;
  return <ChatHistoryList key={scope} scope={scope} organizationName={organization.name} />;
}
