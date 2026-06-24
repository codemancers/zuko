'use client';

import { useMemo, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { EMPLOYEE_RANGE_LABEL } from '@/lib/constants/icp';
import {
  Button,
  Badge,
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from '@zuko/ui-kit';
import { PlusIcon } from '@heroicons/react/20/solid';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { getIcpProfilesInfinite } from '@/server/query-options';
import { icpApi, type IcpProfile } from '@/lib/api/icp';
import { PageHeader, ConfirmDialog } from '@/components/shared';
import { BaseTable, TableActions, DeleteAction } from '@/components/Table';
import IcpForm from './IcpForm';
import { toast } from 'sonner';
import dayjs from 'dayjs';

export default function IcpList() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery(getIcpProfilesInfinite());

  const profiles = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  );
  const totalCount = data?.pages[0]?.total ?? 0;

  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<IcpProfile | null>(
    null,
  );

  const deleteMutation = useMutation({
    mutationFn: (id: number) => icpApi.deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icp', 'profiles'] });
      toast.success('ICP profile deleted');
      setProfileToDelete(null);
    },
    onError: () => toast.error('Failed to delete ICP profile'),
  });

  const actionsColumn: ColumnDef<IcpProfile> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <TableActions>
          <DeleteAction
            onClick={() => setProfileToDelete(row.original)}
            disabled={deleteMutation.isPending}
          />
        </TableActions>
      ),
    }),
    [deleteMutation.isPending],
  );

  const columns: ColumnDef<IcpProfile>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="font-medium text-zinc-900 dark:text-white">
            {row.original.name}
          </div>
        ),
      },
      {
        id: 'industries',
        header: 'Industries',
        cell: ({ row }) => {
          const industries = row.original.filters.industries ?? [];
          return (
            <div className="flex flex-wrap gap-1">
              {industries.slice(0, 3).map((ind) => (
                <Badge key={ind} color="blue">
                  {ind}
                </Badge>
              ))}
              {industries.length > 3 && (
                <Badge color="zinc">+{industries.length - 3}</Badge>
              )}
              {industries.length === 0 && (
                <span className="text-xs text-zinc-400">—</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'employeeRanges',
        header: 'Employee Ranges',
        cell: ({ row }) => {
          const ranges = row.original.filters.employeeRanges ?? [];
          return (
            <div className="flex flex-wrap gap-1">
              {ranges.slice(0, 2).map((r) => (
                <Badge key={r} color="green">
                  {EMPLOYEE_RANGE_LABEL[r] ?? r}
                </Badge>
              ))}
              {ranges.length === 0 && (
                <span className="text-xs text-zinc-400">—</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'locations',
        header: 'Locations',
        cell: ({ row }) => {
          const locs = row.original.filters.locations ?? [];
          return (
            <div className="flex flex-wrap gap-1">
              {locs.slice(0, 2).map((loc) => (
                <Badge key={loc} color="orange">
                  {loc}
                </Badge>
              ))}
              {locs.length > 2 && (
                <Badge color="zinc">+{locs.length - 2}</Badge>
              )}
              {locs.length === 0 && (
                <span className="text-xs text-zinc-400">—</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ getValue }) => dayjs(getValue<string>()).format('MMM D, YYYY'),
      },
      actionsColumn,
    ],
    [actionsColumn],
  );

  return (
    <>
      <PageHeader
        title="ICP Profiles"
        description="Define Ideal Customer Profile criteria and find matching companies via Apollo."
        action={
          <Button onClick={() => setIsCreateSheetOpen(true)}>
            <PlusIcon className="size-4" />
            New ICP Profile
          </Button>
        }
      />

      <BaseTable<IcpProfile>
        columns={columns}
        data={profiles}
        loading={isLoading}
        entityName="ICP profiles"
        onRowClick={(profile) => router.push(`/icps/${profile.id}`)}
        totalCount={totalCount}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onFetchNextPage={fetchNextPage}
        showEmptyState
        emptyStateConfig={{
          icon: AdjustmentsHorizontalIcon,
          title: 'No ICP profiles yet',
          description:
            'Create a profile to define your ideal customer criteria and find matching companies.',
          action: {
            label: 'New ICP Profile',
            onClick: () => setIsCreateSheetOpen(true),
          },
        }}
      />

      <Sheet
        open={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
      >
        <SheetHeader>
          <SheetTitle>New ICP Profile</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <IcpForm
            mode="create"
            onSuccess={() => setIsCreateSheetOpen(false)}
            onCancel={() => setIsCreateSheetOpen(false)}
          />
        </SheetBody>
      </Sheet>

      <ConfirmDialog
        open={!!profileToDelete}
        onClose={() => setProfileToDelete(null)}
        onConfirm={() =>
          profileToDelete && deleteMutation.mutate(profileToDelete.id)
        }
        title="Delete ICP Profile"
        description={`Are you sure you want to delete "${profileToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="red"
      />
    </>
  );
}
