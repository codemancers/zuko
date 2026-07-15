'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { Button, Link } from '@zuko/ui-kit';
import { PageHeader } from '@/components/shared';
import { BaseTable } from '@/components/Table';
import type { ColumnDef } from '@tanstack/react-table';

interface EveSession {
  sessionId: string;
  title: string | null;
  createdAt: string;
}

function formatDate(date: string): string {
  const d = new Date(date);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ChatsList() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['eve-chats'],
    queryFn: async () => {
      const res = await fetch('/api/chats');
      if (!res.ok) return { sessions: [] as EveSession[] };
      return (await res.json()) as { sessions: EveSession[] };
    },
  });

  const sessions = data?.sessions ?? [];

  const columns = useMemo<ColumnDef<EveSession>[]>(
    () => [
      {
        id: 'title',
        header: 'Title',
        accessorKey: 'title',
        cell: ({ row }) => (
          <div className="text-sm font-medium text-zinc-950 dark:text-white">
            <Link
              href={`/chat/${row.original.sessionId}`}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.title?.trim() || 'Untitled chat'}
            </Link>
          </div>
        ),
      },
      {
        id: 'createdAt',
        header: 'Started',
        accessorKey: 'createdAt',
        cell: ({ row }) => (
          <span className="text-zinc-500 dark:text-zinc-400">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Chats"
        description="All your AI conversations"
        action={<Button href="/chat">New chat</Button>}
      />

      <BaseTable<EveSession>
        columns={columns}
        data={sessions}
        loading={isLoading}
        onRowClick={(s) => router.push(`/chat/${s.sessionId}`)}
        entityName="chats"
        showAddColumn={false}
        showEmptyState
        emptyStateConfig={{
          icon: ChatBubbleLeftRightIcon,
          title: 'No chats yet',
          description: 'Start a new chat to see it here.',
          action: { label: 'New chat', onClick: () => router.push('/chat') },
        }}
      />
    </>
  );
}
