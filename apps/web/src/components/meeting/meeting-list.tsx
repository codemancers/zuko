'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, VideoCameraSlashIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import {
  Button,
  Divider,
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
  Heading,
  Input,
} from '@zuko/ui-kit';
import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

function GoogleMeetIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="#00832d" d="M27.5 24l5.6-6.4 1.9 6.4-1.9 6.4z"/>
      <path fill="#0066da" d="M0 31.5v5c0 1.93 1.57 3.5 3.5 3.5H8.5l1-8.9-1-8.1H3.5C1.57 23 0 24.57 0 26.5z"/>
      <path fill="#e94235" d="M8.5 40H21L22 31.5 21 23H8.5z"/>
      <path fill="#2684fc" d="M21 23l-2.09-8.67L21 6h13.8c1.45 0 2.7 1 3.07 2.42L40 12l-2.4 11z"/>
      <path fill="#00ac47" d="M21 40h13.8c1.45 0 2.7-1 3.07-2.42L40 36l-2.4-11H21z"/>
      <path fill="#ffba00" d="M37.13 5.58L33.87 2.42A3.49 3.49 0 0 0 31.3 1.5H21v21.5h16.6V9C37.6 7.55 37.55 6.6 37.13 5.58z"/>
    </svg>
  );
}

function ZoomIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4 shrink-0" aria-hidden="true">
      <rect width="48" height="48" rx="10" fill="#2D8CFF"/>
      <path fill="#fff" d="M8 16a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v10l8-5v10l-8-5v2a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V16z"/>
    </svg>
  );
}

function MSTeamsIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="#5059C9" d="M29.5 17a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z"/>
      <path fill="#7B83EB" d="M18 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z"/>
      <path fill="#5059C9" d="M31 20h10a3 3 0 0 1 3 3v10a9 9 0 0 1-9 9 9 9 0 0 1-9-9V23a3 3 0 0 1 3-3h2z"/>
      <path fill="#7B83EB" d="M4 23a3 3 0 0 1 3-3h22a3 3 0 0 1 3 3v14a11 11 0 0 1-11 11A11 11 0 0 1 4 37V23z"/>
      <path fill="#fff" fillOpacity=".8" d="M18 26v9.5a6.5 6.5 0 0 1-6.5 6.5H11a9 9 0 0 0 7 3 9 9 0 0 0 9-9V26h-9z"/>
      <rect fill="#fff" fillOpacity=".9" x="14" y="26" width="8" height="3" rx="1.5"/>
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
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown>
            <DropdownButton plain aria-label="More options">
              <EllipsisVerticalIcon className="h-5 w-5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" />
            </DropdownButton>
            <DropdownMenu anchor="bottom end">
              <DropdownItem href={`/meeting/${row.original.id}`}>
                View
              </DropdownItem>
              <DropdownItem
                onClick={() => setMeetingToDelete(Number(row.original.id))}
                disabled={deleteMeetingMutation.isPending}
              >
                Delete
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
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
