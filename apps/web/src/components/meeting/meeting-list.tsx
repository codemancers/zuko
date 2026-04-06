'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, VideoCameraSlashIcon, EyeIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  Button,
  Divider,
  Heading,
  Input,
} from '@zuko/ui-kit';
import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

function GoogleMeetIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d="m17,41.98v-20s-10.95-2.05-12.7-.3c-.19.19-.3.45-.3.72v20.52c0,2.85,13-.94,13-.94Z"/>
      <path fill="currentColor" fillOpacity=".7" fillRule="evenodd" d="m36,32.02v9.96h-19.16l-.42,13.04h28.09c2.48,0,4.5-2.01,4.5-4.5v-18.5h-13Z"/>
      <path fill="currentColor" fillOpacity=".5" fillRule="evenodd" d="m4,50.52c0,2.49,2.01,4.5,4.5,4.5h8.5v-13.04H4v8.54h0Z"/>
      <path fill="currentColor" fillOpacity=".6" fillRule="evenodd" d="m16.87,21.98h19.13v10.04l13-.02V13.5c0-1.2-.48-2.34-1.32-3.19-.85-.85-2-1.32-3.19-1.31-8.03.03-24.23-.01-27.06-.02-.27,0-.53.11-.73.3-1.75,1.76.18,12.7.18,12.7Z"/>
      <path fill="currentColor" fillOpacity=".85" fillRule="evenodd" d="m56.8,49.6c-6.53-5.53-20.8-17.58-20.8-17.58,0,0,14.26-12.06,20.8-17.58.58-.49,1.39-.6,2.08-.27.69.32,1.13,1.02,1.13,1.79v32.13c0,.77-.44,1.46-1.13,1.79-.69.33-1.5.22-2.08-.27h0Z"/>
      <polygon fill="currentColor" fillOpacity=".65" fillRule="evenodd" points="49 21.03 49 43.01 36 32.02 49 21.03 49 21.03"/>
      <path fill="currentColor" fillOpacity=".4" fillRule="evenodd" d="m17,21.98v-12.91c-.11.05-.21.12-.3.21-1.75,1.76-10.65,10.65-12.4,12.4-.09.09-.16.19-.21.3h12.91Z"/>
    </svg>
  );
}

function ZoomIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="currentColor" d="M50,2.5C23.766,2.5,2.5,23.823,2.5,50.126c2.502,63.175,92.507,63.157,95,0C97.5,23.823,76.233,2.5,50,2.5z"/>
      <path fill="white" d="M78.285,63.557c-0.051,2.506-2.059,3.352-4.005,1.965c-3.629-2.54-7.233-5.115-10.851-7.669c0.009,1.182-0.007,3.966-0.001,5.177c-0.001,2.246-1.117,3.339-3.41,3.34l-19.536,0.002c-3.31,0.001-6.619,0.002-9.929-0.002c-6.257-0.007-10.462-4.106-10.464-10.201l0-19.205c0-2.278,1.081-3.34,3.4-3.34c7.951,0.151,21.843,0.017,29.638,0.003c5.525,0.006,9.522,3.442,10.19,8.52c3.656-2.58,7.297-5.181,10.963-7.748c1.691-1.227,3.917-0.833,4.005,1.966C78.309,45.151,78.338,54.754,78.285,63.557z"/>
    </svg>
  );
}

function MSTeamsIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="currentColor" fillOpacity=".6" d="M29.5 17a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z"/>
      <path fill="currentColor" fillOpacity=".8" d="M18 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z"/>
      <path fill="currentColor" fillOpacity=".6" d="M31 20h10a3 3 0 0 1 3 3v10a9 9 0 0 1-9 9 9 9 0 0 1-9-9V23a3 3 0 0 1 3-3h2z"/>
      <path fill="currentColor" d="M4 23a3 3 0 0 1 3-3h22a3 3 0 0 1 3 3v14a11 11 0 0 1-11 11A11 11 0 0 1 4 37V23z"/>
      <path fill="white" fillOpacity=".8" d="M18 26v9.5a6.5 6.5 0 0 1-6.5 6.5H11a9 9 0 0 0 7 3 9 9 0 0 0 9-9V26h-9z"/>
      <rect fill="white" fillOpacity=".9" x="14" y="26" width="8" height="3" rx="1.5"/>
    </svg>
  );
}

const PLATFORM_ICONS: Record<string, ReactNode> = {
  GOOGLE_MEET: <GoogleMeetIcon />,
  ZOOM: <ZoomIcon />,
  MS_TEAMS: <MSTeamsIcon />,
};
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTableViewMeetings } from '@/server/query-options';
import { meetingsApi } from '@/lib/api/meetings';
import { BaseTable, createColumnsFromMetadata, type BaseRow } from '@/components/Table';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MeetingFormSchema, type MeetingFormSchemaType } from './add-meeting';

// Inline form shown below the table when user clicks the + button
function InlineAddMeetingForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: meetingsApi.createMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting created successfully');
      onSuccess();
    },
    onError: () => toast.error('Failed to create meeting'),
  });

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<MeetingFormSchemaType>({
    resolver: zodResolver(MeetingFormSchema),
  });

  const onSubmit = (data: MeetingFormSchemaType) => {
    createMutation.mutate({
      url: data.url,
      name: data.name,
      description: data.description,
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex-1">
          <Input
            placeholder="Enter meeting name"
            {...register('name')}
            autoFocus
            autoComplete="off"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>
        <div className="flex-1">
          <Input
            placeholder="Paste meeting URL"
            {...register('url')}
            autoComplete="off"
          />
          {errors.url && (
            <p className="mt-1 text-xs text-red-500">{errors.url.message}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2 pt-0.5">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Adding…' : 'Add'}
          </Button>
          <Button
            type="button"
            plain
            onClick={onCancel}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

export const MeetingList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [meetingToDelete, setMeetingToDelete] = useState<number | null>(null);
  const [isAddingMeeting, setIsAddingMeeting] = useState(false);

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
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <a
            href={`/meeting/${row.original.id}`}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="View"
          >
            <EyeIcon className="h-4 w-4" />
          </a>
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
          {PLATFORM_ICONS[value] ?? null}
          <span>{display as string}</span>
        </div>
      );
    },
  };

  const columns = useMemo(() => {
    const base = createColumnsFromMetadata<BaseRow>(metadata);
    return base.map((col) => (col.id === 'platform' ? platformColumn : col)).concat(actionsColumn);
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
        <Button onClick={() => setIsAddingMeeting(true)}>
          <PlusIcon className="h-4 w-4" />
          Add to a meeting
        </Button>
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
        showAddRow={meetings.length > 0 && !isAddingMeeting}
        onAddRow={() => setIsAddingMeeting(true)}
        showEmptyState={!isAddingMeeting && meetings.length === 0}
        emptyStateConfig={{
          icon: VideoCameraSlashIcon,
          title: 'No Meetings Found',
          description: 'Get started by adding Zuko to your meetings.',
          action: {
            label: 'Add to a meeting',
            onClick: () => setIsAddingMeeting(true),
          },
        }}
      />

      {isAddingMeeting && (
        <InlineAddMeetingForm
          onCancel={() => setIsAddingMeeting(false)}
          onSuccess={() => setIsAddingMeeting(false)}
        />
      )}

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
