'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserInvitations } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useMemo, useState } from 'react';
import {
  EnvelopeOpenIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  BaseTable,
  TableActions,
  TableActionButton,
  createColumnsFromMetadata,
  type BaseRow,
} from '@/components/Table';
import type { ColumnDef } from '@tanstack/react-table';
import type { ColumnMetadata } from '@/types/table-metadata';

type InvitationRow = BaseRow & {
  organizationName: string;
  organizationId: string;
  role: string;
  status: string;
  invitedAt: string | null;
};

const INVITATION_TABLE_METADATA: ColumnMetadata[] = [
  {
    id: 'organizationName',
    header: 'Organization',
    fieldType: 'text',
    dataType: 'text',
    editable: false,
    isVisible: true,
  },
  {
    id: 'role',
    header: 'Role',
    fieldType: 'select',
    dataType: 'text',
    editable: false,
    isVisible: true,
    config: {
      render: 'badge',
      colorMap: {},
    },
  },
  {
    id: 'status',
    header: 'Status',
    fieldType: 'select',
    dataType: 'text',
    editable: false,
    isVisible: true,
    config: {
      render: 'badge',
      colorMap: { pending: 'amber', accepted: 'lime', rejected: 'red' },
    },
  },
  {
    id: 'invitedAt',
    header: 'Invited At',
    fieldType: 'date',
    dataType: 'date',
    editable: false,
    isVisible: true,
    config: { format: 'date' },
  },
];

export const UserInvitations = () => {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const { data: invitations = [], isLoading } = useQuery(getUserInvitations());

  const handleAccept = async (invitationId: string, organizationId: string) => {
    setIsProcessing(invitationId);
    try {
      const { error } = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (error) {
        toast.error(error.message || 'Failed to accept invitation');
        return;
      }
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
      const { error } = await authClient.organization.rejectInvitation({
        invitationId,
      });
      if (error) {
        toast.error(error.message || 'Failed to reject invitation');
        return;
      }
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
        organizationName: inv.organizationName ?? '—',
        organizationId: inv.organizationId,
        role: inv.role,
        status: inv.status,
        invitedAt: inv.createdAt ?? null,
      })),
    [invitations],
  );

  const actionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const inv = row.original as InvitationRow;
        return (
          <TableActions>
            <TableActionButton
              onClick={() => handleAccept(inv.id as string, inv.organizationId)}
              label="Accept invitation"
              disabled={!!isProcessing}
              variant="success"
            >
              <CheckIcon className="h-4 w-4 text-zinc-400 group-data-[hover]:text-green-500 dark:group-data-[hover]:text-green-400" />
            </TableActionButton>
            <TableActionButton
              onClick={() => handleReject(inv.id as string)}
              label="Decline invitation"
              disabled={!!isProcessing}
              variant="danger"
            >
              <XMarkIcon className="h-4 w-4 text-zinc-400 group-data-[hover]:text-red-500 dark:group-data-[hover]:text-red-400" />
            </TableActionButton>
          </TableActions>
        );
      },
    }),
     
    [isProcessing],
  );

  const columns = useMemo(
    () =>
      createColumnsFromMetadata<BaseRow>(INVITATION_TABLE_METADATA).concat(
        actionsColumn,
      ),
    [actionsColumn],
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
    <BaseTable<BaseRow>
      columns={columns}
      data={rows}
      loading={isLoading}
      entityName="invitations"
      disableRowClick
    />
  );
};
