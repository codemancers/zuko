'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { Button, Link } from '@zuko/ui-kit';
import { PageHeader } from '@/components/shared';
import { useChats } from '@/hooks/use-chats';
import { BaseTable } from '@/components/Table';
import type { ColumnDef } from '@tanstack/react-table';

interface Chat {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

function formatUpdatedAt(date: string): string {
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
  const { data: chats = [], isLoading } = useChats();

  const columns = useMemo<ColumnDef<Chat>[]>(
    () => [
      {
        id: 'title',
        header: 'Title',
        accessorKey: 'title',
        cell: ({ row }) => (
          <div className="text-sm font-medium text-zinc-950 dark:text-white">
            <Link
              href={`/chat/${row.original.id}`}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.title || 'Untitled chat'}
            </Link>
          </div>
        ),
      },
      {
        id: 'updatedAt',
        header: 'Last updated',
        accessorKey: 'updatedAt',
        cell: ({ row }) => (
          <span className="text-zinc-500 dark:text-zinc-400">
            {formatUpdatedAt(row.original.updatedAt)}
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

      <BaseTable<Chat>
        columns={columns}
        data={chats}
        loading={isLoading}
        onRowClick={(chat) => router.push(`/chat/${chat.id}`)}
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
