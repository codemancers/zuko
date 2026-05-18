'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { VideoCameraSlashIcon } from '@heroicons/react/24/outline';
import { PageHeader, SearchBar } from '@/components/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTableViewMeetingsInfinite } from '@/server/query-options';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { meetingsApi } from '@/lib/api/meetings';
import {
  BaseTable,
  createColumnsFromMetadata,
  type BaseRow,
  TableActions,
  DeleteAction,
} from '@/components/Table';
import { useSearchParam } from '@/hooks/use-search-param';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export const MeetingList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    inputValue: searchTerm,
    setInputValue: setSearchTerm,
    debouncedValue,
  } = useSearchParam();
  const [meetingToDelete, setMeetingToDelete] = useState<number | null>(null);

  const {
    data: meetingsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    getTableViewMeetingsInfinite({ search: debouncedValue || undefined }),
  );

  const sentinelRef = useInfiniteScroll(fetchNextPage, hasNextPage, isFetchingNextPage);

  const deleteMeetingMutation = useMutation({
    mutationFn: (id: number) => meetingsApi.deleteMeeting(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success(`Meeting deleted: ${id}`);
    },
    onError: () => toast.error('Failed to delete meeting'),
  });

  const meetings = meetingsData?.pages.flatMap((p) => p.data) ?? [];
  const metadata = meetingsData?.pages[0]?.metadata ?? [];
  const totalCount = meetingsData?.pages[0]?.pagination?.total;

  const actionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <TableActions>
          <DeleteAction
            onClick={() => setMeetingToDelete(Number(row.original.id))}
            disabled={deleteMeetingMutation.isPending}
          />
        </TableActions>
      ),
    }),
    [deleteMeetingMutation.isPending],
  );

  const columns = useMemo(() => {
    return createColumnsFromMetadata<BaseRow>(metadata).concat(actionsColumn);
  }, [metadata, actionsColumn]);

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Manage your meeting recordings and transcripts"
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search meetings..."
      />

      <BaseTable<BaseRow>
        columns={columns}
        data={meetings}
        loading={isLoading}
        entityName="meetings"
        onRowClick={(meeting) => router.push(`/meeting/${meeting.id}`)}
        totalCount={totalCount}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        infiniteScrollRef={sentinelRef}
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
    </>
  );
};
