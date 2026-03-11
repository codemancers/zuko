'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  PlusIcon,
  EllipsisVerticalIcon,
  CalendarIcon,
  VideoCameraIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import {
  Button,
  Badge,
  Heading,
  Text,
  Strong,
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
  Input,
  InputGroup,
  Select,
  Divider,
} from '@zuko/ui-kit';
import { toast } from 'sonner';

const ReusableDialog = ({
  showDialog,
  title,
  setIsOpen,
  nextActionClick,
  nextActionText,
}: any) => {
  if (!showDialog) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <Heading className="mb-4">{title}</Heading>
        <div className="flex justify-end gap-3">
          <Button onClick={() => setIsOpen(false)} plain>
            Cancel
          </Button>
          <Button onClick={nextActionClick} color="red">
            {nextActionText}
          </Button>
        </div>
      </div>
    </div>
  );
};

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
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date');
  const [isOpenDeleteDialog, setIsOpenDeleteDialog] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);

  // Dummy Data
  const meetings = [
    {
      id: '1',
      name: 'Weekly Product Sync',
      platform: 'ZOOM',
      status: 'COMPLETED',
      scheduledAt: dayjs().toISOString(),
      timezone: 'UTC',
      createdAt: dayjs().subtract(1, 'day').toISOString(),
    },
    {
      id: '2',
      name: 'Q1 Roadmap Planning',
      platform: 'GOOGLE_MEET',
      status: 'IN_PROGRESS',
      scheduledAt: dayjs().add(2, 'hours').toISOString(),
      timezone: 'UTC',
      createdAt: dayjs().subtract(2, 'days').toISOString(),
    },
    {
      id: '3',
      name: 'Frontend Performance Review',
      platform: 'MICROSOFT_TEAMS',
      status: 'PROCESSING',
      scheduledAt: dayjs().subtract(1, 'hour').toISOString(),
      timezone: 'UTC',
      createdAt: dayjs().subtract(3, 'days').toISOString(),
    },
  ];

  const deleteMeetingMutation = {
    mutate: (id: string) => {
      toast.success('Meeting deleted: ' + id);
    },
    isPending: false,
  };

  // Handle empty state
  if (meetings?.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex-1">
          <Heading>Meetings</Heading>
        </div>
        <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800">
          <Text>No meetings found</Text>
        </div>
      </div>
    );
  }

  const filteredMeetings = (meetings || [])
    .filter((meeting) =>
      meeting.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sort === 'date') {
        const dateA = a.scheduledAt || a.createdAt;
        const dateB = b.scheduledAt || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }
      return 0;
    });

  const openDeleteDialog = (meetingId: string) => {
    setMeetingToDelete(meetingId);
    setIsOpenDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (meetingToDelete) {
      deleteMeetingMutation.mutate(meetingToDelete);
    }
    setIsOpenDeleteDialog(false);
    setMeetingToDelete(null);
  };

  const handleCancelDelete = () => {
    setIsOpenDeleteDialog(false);
    setMeetingToDelete(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex-1">
        <Heading>Meetings</Heading>
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-3">
          <InputGroup className="flex-1">
            <MagnifyingGlassIcon className="h-5 w-5" data-slot="icon" />
            <Input
              placeholder="Search meetings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-96"
            ></Input>
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
        <div className="flex max-w-xl flex-1 gap-3 md:justify-end">
          <Button href="/meeting/add" className="whitespace-nowrap shadow-sm">
            <PlusIcon className="h-5 w-5" aria-hidden="true" />
            Add to a meeting
          </Button>
        </div>
      </div>
      <ul className="mt-4 space-y-4">
        <Divider />
        {filteredMeetings.map((meeting) => (
          <li key={meeting.id} className="group">
            <div className="flex items-center justify-between">
              <div className="flex gap-6 py-6">
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => router.push(`/meeting/${meeting.id}`)}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex min-w-0 items-center justify-between">
                      <Strong className="truncate text-lg font-semibold">
                        {meeting.name}
                      </Strong>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-6 text-sm text-zinc-500">
                      <div className="flex items-center gap-2">
                        <VideoCameraIcon className="h-4 w-4" />
                        <Text className="text-sm">
                          {meeting.platform.replace(/_/g, ' ')}
                        </Text>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        <Text className="text-sm">
                          {meeting.scheduledAt
                            ? dayjs(meeting.scheduledAt)
                                .tz(meeting.timezone)
                                .format('MMM D, YYYY [at] h:mm A')
                            : dayjs(meeting.createdAt).format(
                                'MMM D, YYYY [at] h:mm A',
                              )}
                        </Text>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Badge
                  color={
                    MEETING_STATUS_COLOR_MAP[meeting.status.toLowerCase()] ??
                    'zinc'
                  }
                  className="text-xs font-semibold uppercase"
                >
                  {meeting.status.replace(/_/g, ' ')}
                </Badge>
                <Dropdown>
                  <DropdownButton plain aria-label="More options">
                    <EllipsisVerticalIcon className="h-5 w-5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" />
                  </DropdownButton>
                  <DropdownMenu anchor="bottom end">
                    <DropdownItem href={`/meeting/${meeting.id}`}>
                      View
                    </DropdownItem>
                    <DropdownItem
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        openDeleteDialog(meeting.id.toString());
                      }}
                      disabled={deleteMeetingMutation.isPending}
                    >
                      Delete
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
            <Divider />
          </li>
        ))}
      </ul>
      <ReusableDialog
        setIsOpen={setIsOpenDeleteDialog}
        cancelActionText="Cancel"
        showDialog={isOpenDeleteDialog}
        title="Are you sure you want to delete this meeting?"
        nextActionClick={handleConfirmDelete}
        nextActionText={'Delete'}
        nextActionLoadingText="Deleting..."
        isPending={deleteMeetingMutation.isPending}
        cancelAction={handleCancelDelete}
      />
    </div>
  );
};
