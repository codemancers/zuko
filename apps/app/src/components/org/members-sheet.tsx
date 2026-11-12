'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import { Link2, Trash2, X } from 'lucide-react';
import { useCellStatus, useRowChanges, useSheet, useSheetCellEditing } from '@codemancers/sheets';
import {
  Sheet,
  SheetActionsCell,
  SheetEditableTextCell,
  SheetTextCell,
} from '@codemancers/sheets/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { readSorting } from './sorting';

type Org = NonNullable<ReturnType<typeof authClient.useActiveOrganization>['data']>;

type Row = {
  id: string;
  kind: 'member' | 'invite' | 'new';
  email: string;
  name: string;
  role: string;
  userId?: string;
};

const NEW_ROW = 'new';
const newRowPinned = { top: [], bottom: [NEW_ROW] };
const noPinnedRows = { top: [], bottom: [] };
const ROLES = ['member', 'admin', 'owner'];

const col = createColumnHelper<Row>();

// Refetches the active organization, which carries the member and invitation lists.
const refresh = () => authClient.$store.notify('$activeOrgSignal');

function inviteLink(invitationId: string) {
  return `${window.location.origin}/accept-invitation/${invitationId}`;
}

function RoleCell({ row, editable }: { row: Row; editable: boolean }) {
  const cell = useSheetCellEditing();
  if (!editable) {
    return (
      <SheetTextCell className="flex items-center">
        <Badge variant="secondary" className="capitalize">
          {row.role}
        </Badge>
      </SheetTextCell>
    );
  }
  // Staged through the sheet's row buffer, which saves it and shows the saving, saved
  // (tick) or refused state on this cell.
  const shown = String(cell.stagedValue ?? cell.refusedValue ?? row.role);
  return (
    <div className="flex h-8 items-center px-2">
      <select
        aria-label={`Role for ${row.email}`}
        value={shown}
        onChange={(event) => void cell.stage(event.target.value)}
        className="h-5 w-fit cursor-pointer appearance-none rounded-4xl bg-secondary px-2 text-xs font-medium text-secondary-foreground capitalize transition-colors outline-none hover:bg-secondary/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
    </div>
  );
}

export function MembersSheet({
  org,
  myUserId,
  myRole,
}: {
  org: Org;
  myUserId: string;
  myRole: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sorting = useMemo(() => readSorting(new URLSearchParams(searchParams)), [searchParams]);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Permission checks use better-auth's role helper, so custom roles later just work.
  const can = (permissions: Record<string, string[]>) =>
    authClient.organization.checkRolePermission({
      role: myRole as 'member',
      permissions,
    });
  const canInvite = can({ invitation: ['create'] });
  const canUpdate = can({ member: ['update'] });
  const canDelete = can({ member: ['delete'] });
  const isOwner = myRole.includes('owner');

  const rows = useMemo<Row[]>(() => {
    const members = org.members.map<Row>((m) => ({
      id: m.id,
      kind: 'member',
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      userId: m.userId,
    }));
    const invites = org.invitations
      .filter((i) => i.status === 'pending')
      .map<Row>((i) => ({
        id: i.id,
        kind: 'invite',
        email: i.email,
        name: '',
        role: i.role ?? 'member',
      }));
    const all = [...members, ...invites];
    return adding
      ? [...all, { id: NEW_ROW, kind: 'new', email: '', name: '', role: 'member' }]
      : all;
  }, [org.members, org.invitations, adding]);

  const cellStatus = useCellStatus();
  const rowChanges = useRowChanges({
    cellStatus,
    onSubmitRow: async (memberId, changes) => {
      const { error } = await authClient.organization.updateMemberRole({
        memberId,
        role: changes.role as 'member' | 'admin' | 'owner',
        organizationId: org.id,
      });
      refresh();
      if (error) {
        const message = error.message ?? 'Could not change the role.';
        return { error: message, fieldErrors: { role: [message] } };
      }
      return undefined;
    },
  });

  const columns = useMemo(() => {
    // Admins can't touch owners, and nobody edits their own membership here.
    const manageable = (r: Row) => r.userId !== myUserId && (isOwner || !r.role.includes('owner'));

    async function run(action: () => Promise<{ error: { message?: string } | null }>) {
      setActionError(null);
      const { error } = await action();
      refresh();
      if (error) setActionError(error.message ?? 'That did not work. Try again.');
    }

    return [
      col.accessor('name', {
        header: 'Name',
        size: 240,
        cell: ({ row }) => {
          const r = row.original;
          if (r.kind === 'invite') return <SheetTextCell muted>Invited</SheetTextCell>;
          return (
            <SheetTextCell>
              <span className="flex items-center gap-2">
                {r.name}
                {r.userId === myUserId && <Badge variant="secondary">You</Badge>}
              </span>
            </SheetTextCell>
          );
        },
      }),
      col.accessor('email', {
        header: 'Email',
        size: 320,
        cell: ({ row }) =>
          row.original.kind === 'new' ? (
            <SheetEditableTextCell
              value=""
              placeholder="Email to invite"
              autoFocus
              onCommit={async (email) => {
                const { data, error } = await authClient.organization.inviteMember({
                  email: email.trim(),
                  role: 'member',
                  organizationId: org.id,
                });
                if (error)
                  return {
                    error: error.message ?? 'Could not create the invite.',
                  };
                setAdding(false);
                refresh();
                // The link is the only way to deliver an invite, so copy it right away.
                if (data)
                  navigator.clipboard?.writeText(inviteLink(data.id)).catch(() => undefined);
                return undefined;
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <SheetTextCell>{row.original.email}</SheetTextCell>
          ),
      }),
      col.accessor('role', {
        header: 'Role',
        size: 160,
        cell: ({ row }) => (
          <RoleCell
            row={row.original}
            editable={row.original.kind === 'member' && canUpdate && manageable(row.original)}
          />
        ),
      }),
      col.display({
        id: 'actions',
        header: 'Actions',
        size: 140,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          if (r.kind === 'new') return null;
          if (r.kind === 'invite') {
            return (
              <SheetActionsCell className="py-1!">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Copy invite link for ${r.email}`}
                  title={copied === r.id ? 'Copied' : 'Copy invite link'}
                  onClick={() => {
                    navigator.clipboard?.writeText(inviteLink(r.id)).catch(() => undefined);
                    setCopied(r.id);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                >
                  <Link2 aria-hidden />
                </Button>
                {canInvite && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={`Cancel invite for ${r.email}`}
                    title="Cancel invite"
                    onClick={() =>
                      run(() =>
                        authClient.organization.cancelInvitation({
                          invitationId: r.id,
                        }),
                      )
                    }
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </SheetActionsCell>
            );
          }
          if (!canDelete || !manageable(r)) return null;
          return (
            <SheetActionsCell className="py-1!">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={`Remove ${r.name}`}
                title="Remove member"
                onClick={() => {
                  if (!window.confirm(`Remove ${r.name} from ${org.name}?`)) return;
                  void run(() =>
                    authClient.organization.removeMember({
                      memberIdOrEmail: r.id,
                      organizationId: org.id,
                    }),
                  );
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            </SheetActionsCell>
          );
        },
      }),
    ];
  }, [org.id, org.name, myUserId, isOwner, canUpdate, canDelete, canInvite, copied]);

  const sheet = useSheet({
    columns,
    data: rows,
    getRowId: (row) => row.id,
    cellStatus,
    rowChanges,
    state: { rowPinning: adding ? newRowPinned : noPinnedRows, sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const params = new URLSearchParams(searchParams);
      params.delete('sort');
      params.delete('order');
      if (next[0]) {
        params.set('sort', next[0].id);
        params.set('order', next[0].desc ? 'desc' : 'asc');
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {actionError && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}
      <div className="min-h-0 flex-1">
        <Sheet
          instance={sheet}
          emptyState="No members yet."
          onAddRow={canInvite && !adding ? () => setAdding(true) : undefined}
          labels={{ addRow: 'Invite member' }}
        />
      </div>
    </div>
  );
}
