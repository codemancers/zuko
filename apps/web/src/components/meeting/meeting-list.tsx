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
import { toast } from 'sonner';
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

  const columns = useMemo(
    () => [...createColumnsFromMetadata<BaseRow>(metadata), actionsColumn],
    [metadata, actionsColumn],
  );

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
