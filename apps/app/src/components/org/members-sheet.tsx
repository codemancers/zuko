'use client';

import { useMemo, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Link2, Trash2, X } from 'lucide-react';
import { useSheet, useSheetCellEditing } from '@codemancers/sheets';
import {
  Sheet,
  SheetActionsCell,
  SheetEditableTextCell,
  SheetTextCell,
} from '@codemancers/sheets/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

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

function RoleCell({ row, orgId, editable }: { row: Row; orgId: string; editable: boolean }) {
  const cell = useSheetCellEditing();
  if (!editable) {
    return (
      <SheetTextCell>
        <Badge variant="secondary" className="capitalize">
          {row.role}
        </Badge>
      </SheetTextCell>
    );
  }
  const shown = String(cell.submittingValue ?? cell.refusedValue ?? row.role);
  return (
    <select
      aria-label={`Role for ${row.email}`}
      value={shown}
      onChange={(event) =>
        cell.submit(
          async (role: string) => {
            const { error } = await authClient.organization.updateMemberRole({
              memberId: row.id,
              role: role as 'member' | 'admin' | 'owner',
              organizationId: orgId,
            });
            refresh();
            return error ? { error: error.message ?? 'Could not change the role.' } : undefined;
          },
          event.target.value,
          'Could not change the role.',
        )
      }
      className="h-full w-full bg-transparent px-2 text-sm capitalize outline-none"
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
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
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Permission checks use better-auth's role helper, so custom roles later just work.
  const can = (permissions: Record<string, string[]>) =>
    authClient.organization.checkRolePermission({ role: myRole as 'member', permissions });
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
    return adding ? [...all, { id: NEW_ROW, kind: 'new', email: '', name: '', role: 'member' }] : all;
  }, [org.members, org.invitations, adding]);

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
                if (error) return { error: error.message ?? 'Could not create the invite.' };
                setAdding(false);
                refresh();
                // The link is the only way to deliver an invite, so copy it right away.
                if (data) navigator.clipboard?.writeText(inviteLink(data.id)).catch(() => undefined);
                return undefined;
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <SheetTextCell>{row.original.email}</SheetTextCell>
          ),
      }),
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
      col.accessor('role', {
        header: 'Role',
        size: 160,
        cell: ({ row }) => (
          <RoleCell
            row={row.original}
            orgId={org.id}
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
              <SheetActionsCell>
                <Button
                  variant="ghost"
                  size="icon"
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
                    aria-label={`Cancel invite for ${r.email}`}
                    title="Cancel invite"
                    onClick={() => run(() => authClient.organization.cancelInvitation({ invitationId: r.id }))}
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </SheetActionsCell>
            );
          }
          if (!canDelete || !manageable(r)) return null;
          return (
            <SheetActionsCell>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${r.name}`}
                title="Remove member"
                onClick={() => {
                  if (!window.confirm(`Remove ${r.name} from ${org.name}?`)) return;
                  void run(() =>
                    authClient.organization.removeMember({ memberIdOrEmail: r.id, organizationId: org.id }),
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
    state: { rowPinning: adding ? newRowPinned : noPinnedRows },
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
