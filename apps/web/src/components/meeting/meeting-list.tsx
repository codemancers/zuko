'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  PlusIcon,
  CalendarIcon,
  VideoCameraIcon,
  MagnifyingGlassIcon,
  VideoCameraSlashIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
  Heading,
  Input,
  InputGroup,
  Select,
} from '@zuko/ui-kit';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMeetings } from '@/server/query-options';
import { meetingsApi, type Meeting } from '@/lib/api/meetings';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { BaseTable } from '@/components/Table/BaseTable';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MeetingFormSchema, type MeetingFormSchemaType } from './add-meeting';

dayjs.extend(utc);
dayjs.extend(timezone);

type BadgeColor =
  | 'zinc'
  | 'indigo'
  | 'cyan'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'sky'
  | 'blue'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose';

const MEETING_STATUS_COLOR_MAP: Record<string, BadgeColor> = {
  completed: 'lime',
  failed: 'red',
  in_progress: 'blue',
  processing: 'blue',
};

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
    onSuccess: (response) => {
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
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date');
  const [meetingToDelete, setMeetingToDelete] = useState<number | null>(null);
  const [isAddingMeeting, setIsAddingMeeting] = useState(false);

  const { data: meetings = [], isLoading } = useQuery(getMeetings);

  const deleteMeetingMutation = useMutation({
    mutationFn: (id: number) => meetingsApi.deleteMeeting(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success(`Meeting deleted: ${id}`);
    },
    onError: () => toast.error('Failed to delete meeting'),
  });

  const filteredMeetings = useMemo(
    () =>
      (meetings || [])
        .filter((meeting) =>
          (meeting.name ?? '').toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => {
          if (sort === 'name') {
            return (a.name ?? '').localeCompare(b.name ?? '');
          } else if (sort === 'date') {
            const dateA = a.scheduledAt || a.createdAt;
            const dateB = b.scheduledAt || b.createdAt;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          }
          return 0;
        }),
    [meetings, search, sort],
  );

  const columns: ColumnDef<Meeting>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        cell: ({ row }) => (
          <span className="font-medium text-zinc-900 dark:text-white">
            {row.original.name ?? '(Untitled)'}
          </span>
        ),
      },
      {
        id: 'platform',
        header: 'Platform',
        accessorKey: 'platform',
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <VideoCameraIcon className="h-4 w-4 text-zinc-400" />
            <span>{row.original.platform.replace(/_/g, ' ')}</span>
          </div>
        ),
      },
      {
        id: 'scheduledAt',
        header: 'Date',
        accessorKey: 'scheduledAt',
        cell: ({ row }) => {
          const meeting = row.original;
          const dateStr = meeting.scheduledAt || meeting.createdAt;
          return (
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <CalendarIcon className="h-4 w-4 text-zinc-400" />
              <span>
                {dayjs(dateStr)
                  .tz(meeting.timezone ?? 'UTC')
                  .format('MMM D, YYYY [at] h:mm A')}
              </span>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <Badge
            color={
              MEETING_STATUS_COLOR_MAP[row.original.status.toLowerCase()] ??
              'zinc'
            }
            className="text-xs font-semibold uppercase"
          >
            {row.original.status.replace(/_/g, ' ')}
          </Badge>
        ),
      },
      {
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
                  onClick={() => setMeetingToDelete(row.original.id)}
                  disabled={deleteMeetingMutation.isPending}
                >
                  Delete
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        ),
      },
    ],
    [deleteMeetingMutation.isPending],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <Heading>Meetings</Heading>
        <Button onClick={() => setIsAddingMeeting(true)}>
          <PlusIcon className="h-4 w-4" />
          Add to a meeting
        </Button>
      </div>

      <div className="flex gap-3">
        <InputGroup className="flex-1">
          <MagnifyingGlassIcon className="h-5 w-5" data-slot="icon" />
          <Input
            placeholder="Search meetings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </InputGroup>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="max-w-40"
        >
          <option value="name">Sort by name</option>
          <option value="date">Sort by date</option>
        </Select>
      </div>

      <BaseTable<Meeting>
        columns={columns}
        data={filteredMeetings}
        loading={isLoading}
        entityName="meetings"
        disableRowClick={false}
        onRowClick={(meeting) => router.push(`/meeting/${meeting.id}`)}
        showAddRow={filteredMeetings.length > 0 && !isAddingMeeting}
        onAddRow={() => setIsAddingMeeting(true)}
        showEmptyState={!isAddingMeeting && filteredMeetings.length === 0}
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
