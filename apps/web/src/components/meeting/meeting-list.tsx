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

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-sm text-zinc-600 dark:text-zinc-400">
          Loading meetings...
        </div>
      )}

      {!isLoading && filteredMeetings.length === 0 && (
        <div className="mt-40 text-center">
          <VideoCameraSlashIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <h3 className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">
            No Meetings Found
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Get started by adding Zuko to your meetings.
          </p>
          <div className="mt-6">
            <Button onClick={() => router.push('/meeting/add')}>
              <PlusIcon className="h-4 w-4" />
              Add to a meeting
            </Button>
          </div>
        </div>
      )}

      {!isLoading && filteredMeetings.length > 0 && (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {filteredMeetings.map((meeting: Meeting) => (
            <li
              key={meeting.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <div
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-4"
                onClick={() => router.push(`/meeting/${meeting.id}`)}
              >
                <span className="min-w-0 flex-1 font-medium text-zinc-900 dark:text-white">
                  {meeting.name ?? '(Untitled)'}
                </span>
                <div className="hidden items-center gap-2 text-sm text-zinc-500 sm:flex">
                  <VideoCameraIcon className="h-4 w-4 text-zinc-400" />
                  <span>{meeting.platform.replace(/_/g, ' ')}</span>
                </div>
                <div className="hidden items-center gap-2 text-sm text-zinc-500 md:flex">
                  <CalendarIcon className="h-4 w-4 text-zinc-400" />
                  <span>
                    {meeting.scheduledAt
                      ? dayjs(meeting.scheduledAt)
                          .tz(meeting.timezone)
                          .format('MMM D, YYYY [at] h:mm A')
                      : dayjs(meeting.createdAt).format(
                          'MMM D, YYYY [at] h:mm A',
                        )}
                  </span>
                </div>
                <Badge
                  color={
                    MEETING_STATUS_COLOR_MAP[meeting.status.toLowerCase()] ??
                    'zinc'
                  }
                  className="text-xs font-semibold uppercase"
                >
                  {meeting.status.replace(/_/g, ' ')}
                </Badge>
              </div>

              <div
                className="ml-2 flex shrink-0 items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <Dropdown>
                  <DropdownButton plain aria-label="More options">
                    <EllipsisVerticalIcon className="h-5 w-5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" />
                  </DropdownButton>
                  <DropdownMenu anchor="bottom end">
                    <DropdownItem href={`/meeting/${meeting.id}`}>
                      View
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => setMeetingToDelete(meeting.id)}
                      disabled={deleteMeetingMutation.isPending}
                    >
                      Delete
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </li>
          ))}
        </ul>
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
