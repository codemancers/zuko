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
import { BaseTable } from '@/components/Table';
import type { ColumnDef } from '@tanstack/react-table';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

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

export const MeetingList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date');
  const [meetingToDelete, setMeetingToDelete] = useState<number | null>(null);

  const { data: meetings = [], isLoading } = useQuery(getMeetings);

  const deleteMeetingMutation = useMutation({
    mutationFn: (id: number) => meetingsApi.deleteMeeting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting deleted');
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

  const columns = useMemo<ColumnDef<Meeting, any>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="font-medium text-zinc-900 dark:text-white">
            {row.original.name ?? '(Untitled)'}
          </span>
        ),
      },
      {
        id: 'platform',
        accessorKey: 'platform',
        header: 'Platform',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <VideoCameraIcon className="h-4 w-4 text-zinc-400" />
            <span>{row.original.platform.replace(/_/g, ' ')}</span>
          </div>
        ),
      },
      {
        id: 'scheduledAt',
        accessorKey: 'scheduledAt',
        header: 'Date',
        cell: ({ row }) => {
          const { scheduledAt, createdAt, timezone: tz } = row.original;
          return (
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-zinc-400" />
              <span>
                {scheduledAt
                  ? dayjs(scheduledAt).tz(tz).format('MMM D, YYYY [at] h:mm A')
                  : dayjs(createdAt).format('MMM D, YYYY [at] h:mm A')}
              </span>
            </div>
          );
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
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
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Dropdown>
              <DropdownButton plain aria-label="More options">
                <EllipsisVerticalIcon className="h-5 w-5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" />
              </DropdownButton>
              <DropdownMenu anchor="bottom end">
                <DropdownItem href={`/meeting/${row.original.id}`}>View</DropdownItem>
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
        <Button href="/meeting/add">
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
        onRowClick={(meeting) => router.push(`/meeting/${meeting.id}`)}
        entityName="meetings"
        showEmptyState
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
