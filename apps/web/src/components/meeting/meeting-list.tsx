'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { VideoCameraSlashIcon, EyeIcon, TrashIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';
import {
  Badge,
  Divider,
  Heading,
  Input,
} from '@zuko/ui-kit';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

const PLATFORM_ICON_PATHS: Record<string, string> = {
  GOOGLE_MEET: '/icons/google-meet.svg',
  ZOOM: '/icons/zoom.svg',
  MS_TEAMS: '/icons/ms-teams.svg',
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTableViewMeetings } from '@/server/query-options';
import { meetingsApi } from '@/lib/api/meetings';
import { BaseTable, createColumnsFromMetadata, type BaseRow } from '@/components/Table';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export const MeetingList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [meetingToDelete, setMeetingToDelete] = useState<number | null>(null);

  const { data: meetingsData, isLoading } = useQuery(
    getTableViewMeetings({ search: searchTerm || undefined }),
  );

  const deleteMeetingMutation = useMutation({
    mutationFn: (id: number) => meetingsApi.deleteMeeting(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success(`Meeting deleted: ${id}`);
    },
    onError: () => toast.error('Failed to delete meeting'),
  });

  const meetings = meetingsData?.data || [];
  const metadata = meetingsData?.metadata || [];

  const actionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/meeting/${row.original.id}`}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="View"
          >
            <EyeIcon className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setMeetingToDelete(Number(row.original.id))}
            disabled={deleteMeetingMutation.isPending}
            className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 disabled:opacity-50"
            aria-label="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    }),
    [deleteMeetingMutation.isPending],
  );

  const platformColumn: ColumnDef<BaseRow> = {
    id: 'platform',
    header: 'Platform',
    cell: ({ row }) => {
      const raw = (row.original as unknown as Record<string, unknown>)['platform'] as { value?: string; display?: string } | string | undefined;
      const value = typeof raw === 'object' && raw !== null ? (raw.value ?? '') : (raw ?? '');
      const display = typeof raw === 'object' && raw !== null ? (raw.display ?? value) : value;
      return (
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          {PLATFORM_ICON_PATHS[value] && (
            <Image src={PLATFORM_ICON_PATHS[value]} alt={display as string} width={16} height={16} className="shrink-0 grayscale" />
          )}
          <span>{display as string}</span>
        </div>
      );
    },
  };

  const joinColumn: ColumnDef<BaseRow> = {
    id: 'join',
    header: 'Join',
    cell: ({ row }) => {
      const url = (row.original as unknown as Record<string, unknown>)['url'] as string | undefined;
      if (!url) return null;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Badge color="blue" className="inline-flex items-center gap-1 cursor-pointer">
            <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            Join
          </Badge>
        </a>
      );
    },
  };

  const columns = useMemo(() => {
    const base = createColumnsFromMetadata<BaseRow>(metadata);
    return base
      .map((col) => (col.id === 'platform' ? platformColumn : col))
      .concat(joinColumn, actionsColumn);
  }, [metadata, actionsColumn]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <Heading>Meetings</Heading>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your meeting recordings and transcripts
          </p>
        </div>
      </div>

      <Divider className="mt-6" />

      <div className="mt-6">
        <Input
          type="search"
          placeholder="Search meetings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      <BaseTable<BaseRow>
        columns={columns}
        data={meetings}
        loading={isLoading}
        entityName="meetings"
        disableRowClick={false}
        onRowClick={(meeting) => router.push(`/meeting/${meeting.id}`)}
        totalCount={meetingsData?.pagination?.total}
        showAddRow
        onAddRow={() => router.push('/meeting/add')}
        showEmptyState={meetings.length === 0}
        emptyStateConfig={{
          icon: VideoCameraSlashIcon,
          title: 'No Meetings Found',
          description: 'Get started by adding Zuko to your meetings.',
          action: {
            label: 'Add to a meeting',
            onClick: () => router.push('/meeting/add'),
          },
        }}
      />

      <ConfirmDialog
        open={meetingToDelete !== null}
        title="Delete Meeting"
        description="Are you sure you want to delete this meeting?"
        confirmText="Delete"
        confirmColor="red"
        onConfirm={() => {
          if (meetingToDelete !== null) {
            deleteMeetingMutation.mutate(meetingToDelete);
          }
          setMeetingToDelete(null);
        }}
        onClose={() => setMeetingToDelete(null)}
        isLoading={deleteMeetingMutation.isPending}
      />
    </div>
  );
};
