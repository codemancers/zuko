'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserInvitations } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { Badge } from '@zuko/ui-kit';
import { toast } from 'sonner';
import { useMemo, useState } from 'react';
import { EnvelopeOpenIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { BaseTable, TableActions, TableActionButton, EMPTY_VALUE } from '@/components/Table';
import type { ColumnDef } from '@tanstack/react-table';
import type { BaseRow } from '@/components/Table/types';
import dayjs from 'dayjs';

type InvitationRow = BaseRow & {
  organizationName: string;
  organizationId: string;
  role: string;
  status: string;
  invitedAt: string | null;
};

export const UserInvitations = () => {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const { data: invitations = [], isLoading } = useQuery(getUserInvitations());

  const handleAccept = async (invitationId: string, organizationId: string) => {
    setIsProcessing(invitationId);
    try {
      const { error } = await authClient.organization.acceptInvitation({ invitationId });
      if (error) { toast.error(error.message || 'Failed to accept invitation'); return; }
      toast.success('Invitation accepted');
      await authClient.organization.setActive({ organizationId });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'invitations'] });
      window.location.reload();
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (invitationId: string) => {
    setIsProcessing(invitationId);
    try {
      const { error } = await authClient.organization.rejectInvitation({ invitationId });
      if (error) { toast.error(error.message || 'Failed to reject invitation'); return; }
      toast.success('Invitation declined');
      queryClient.invalidateQueries({ queryKey: ['user', 'invitations'] });
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsProcessing(null);
    }
  };

  const rows: InvitationRow[] = useMemo(
    () =>
      invitations.map((inv: any) => ({
        id: inv.id,
        organizationName: inv.organizationName ?? EMPTY_VALUE,
        organizationId: inv.organizationId,
        role: inv.role,
        status: inv.status,
        invitedAt: inv.createdAt ?? null,
      })),
    [invitations],
  );

  const columns = useMemo(
    (): ColumnDef<InvitationRow>[] => [
      {
        id: 'organization',
        header: 'Organization',
        accessorKey: 'organizationName',
        cell: ({ row }) => (
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {row.original.organizationName}
          </span>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        accessorKey: 'role',
        size: 140,
        cell: ({ row }) => (
          <Badge color="zinc" className="capitalize">
            {row.original.role}
          </Badge>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        size: 120,
        cell: ({ row }) => (
          <Badge color="amber" className="capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: 'invitedAt',
        header: 'Invited At',
        accessorKey: 'invitedAt',
        size: 180,
        cell: ({ row }) => (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {row.original.invitedAt
              ? dayjs(row.original.invitedAt).format('MMM D, YYYY h:mm A')
              : EMPTY_VALUE}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <div className="text-center">Actions</div>,
        size: 120,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <TableActions>
              <TableActionButton
                onClick={() => handleAccept(row.original.id as string, row.original.organizationId)}
                label="Accept invitation"
                disabled={!!isProcessing}
                variant="success"
              >
                <CheckIcon className="h-4 w-4 text-zinc-400 group-data-[hover]:text-green-500 dark:group-data-[hover]:text-green-400" />
              </TableActionButton>
              <TableActionButton
                onClick={() => handleReject(row.original.id as string)}
                label="Decline invitation"
                disabled={!!isProcessing}
                variant="danger"
              >
                <XMarkIcon className="h-4 w-4 text-zinc-400 group-data-[hover]:text-red-500 dark:group-data-[hover]:text-red-400" />
              </TableActionButton>
            </TableActions>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line
    [isProcessing],
  );

  if (!isLoading && rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-white/10">
          <EnvelopeOpenIcon className="size-8 text-zinc-400" />
        </div>
        <div className="mt-6 text-base font-semibold text-zinc-950 dark:text-white">
          No invitations
        </div>
        <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          You don't have any pending invitations at the moment.
        </div>
      </div>
    );
  }

  return (
    <BaseTable<InvitationRow>
      columns={columns}
      data={rows}
      loading={isLoading}
      entityName="invitations"
      disableRowClick
    />
  );
};
