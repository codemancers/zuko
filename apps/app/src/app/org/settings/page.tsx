'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Shell } from '@/components/dashboard/shell';
import { UserMenu } from '@/components/dashboard/user-menu';
import { MembersSheet } from '@/components/org/members-sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient, useSession } from '@/lib/auth-client';

type Org = NonNullable<ReturnType<typeof authClient.useActiveOrganization>['data']>;

function FieldLabel({ children, saved }: { children: React.ReactNode; saved?: boolean }) {
  return (
    <dt className="flex h-5 items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
      {children}
      {saved && <Check className="size-3.5 text-green-500" aria-label="Saved" />}
    </dt>
  );
}

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <dd className="min-h-8 py-1 text-sm">{children}</dd>
    </div>
  );
}

const SAVE_DEBOUNCE_MS = 700;

/**
 * Notion-style: always an input, styled to read as plain text. It saves once typing pauses
 * (or on blur / Enter); Escape reverts. A tick appears beside the label once saved.
 */
function EditableField({
  label,
  value,
  canEdit,
  onSave,
}: {
  label: string;
  value: string;
  canEdit: boolean;
  onSave: (next: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const draftRef = useRef(value); // Latest typed text, readable from async callbacks.
  const lastSaved = useRef(value); // What the server is known to hold.
  const inFlight = useRef(false);

  // Follow the saved value (e.g. after a refetch) unless the user is mid-edit.
  useEffect(() => {
    if (focused) return;
    setDraft(value);
    draftRef.current = value;
    lastSaved.current = value;
    setError(null); // Leaving the field drops any refused text, so its error goes too.
  }, [value, focused]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(savedTimer.current);
    },
    [],
  );

  async function flush() {
    clearTimeout(timer.current);
    if (inFlight.current) return; // The running save re-checks the draft when it finishes.
    const next = draftRef.current.trim();
    if (!next || next === lastSaved.current) return;

    inFlight.current = true;
    const failure = await onSave(next);
    inFlight.current = false;

    if (failure) {
      setError(failure);
      return;
    }
    lastSaved.current = next;
    setError(null);
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
    // Typing continued during the request: save that too.
    if (draftRef.current.trim() !== next) void flush();
  }

  function change(next: string) {
    setDraft(next);
    draftRef.current = next;
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }

  function revert() {
    clearTimeout(timer.current);
    setDraft(lastSaved.current);
    draftRef.current = lastSaved.current;
    setError(null);
  }

  return (
    <div className="space-y-1.5">
      <FieldLabel saved={saved}>{label}</FieldLabel>
      <dd>
        <input
          aria-label={label}
          aria-invalid={!!error}
          value={draft}
          readOnly={!canEdit}
          onChange={(e) => change(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={async () => {
            setFocused(false);
            await flush();
            // An empty value is never saved; put the last saved text back.
            if (!draftRef.current.trim()) revert();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              revert();
              e.currentTarget.blur();
            }
          }}
          className="-mx-2 h-8 w-[calc(100%+1rem)] rounded-md bg-transparent px-2 text-sm outline-none transition-colors read-only:cursor-default aria-invalid:bg-destructive/10"
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </dd>
    </div>
  );
}

function DetailsPanel({ org, role, canEdit }: { org: Org; role: string; canEdit: boolean }) {
  const save = (data: { name?: string; slug?: string }) => async (): Promise<string | null> => {
    const { error } = await authClient.organization.update({ organizationId: org.id, data });
    return error ? (error.message ?? 'Could not save.') : null;
  };

  return (
    <dl className="grid gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      <EditableField
        label="Name"
        value={org.name}
        canEdit={canEdit}
        onSave={(name) => save({ name })()}
      />
      <EditableField
        label="Slug"
        value={org.slug}
        canEdit={canEdit}
        onSave={(slug) => save({ slug })()}
      />
      <ReadOnlyField label="Created">
        {new Date(org.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
      </ReadOnlyField>
      <ReadOnlyField label="Members">{org.members.length}</ReadOnlyField>
      <ReadOnlyField label="Pending invites">
        {org.invitations.filter((i) => i.status === 'pending').length}
      </ReadOnlyField>
      <ReadOnlyField label="Your role">
        <Badge variant="secondary" className="capitalize">
          {role}
        </Badge>
      </ReadOnlyField>
    </dl>
  );
}

export default function OrganizationSettingsPage() {
  const { data: session, isPending } = useSession();
  const { data: org, isPending: orgPending } = authClient.useActiveOrganization();
  const { data: me } = authClient.useActiveMember();

  if (isPending) {
    return (
      <Shell fill menu={<Skeleton className="size-8 rounded-full" />}>
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Shell>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <Button asChild>
          <Link href="/login">Log in</Link>
        </Button>
      </main>
    );
  }

  const { name, email, image } = session.user;
  const myRole = me?.role ?? '';
  // better-auth's permission helper, rather than matching role names by hand.
  const canEdit =
    !!myRole &&
    authClient.organization.checkRolePermission({
      role: myRole as 'member',
      permissions: { organization: ['update'] },
    });

  return (
    <Shell fill menu={<UserMenu name={name} email={email} image={image} />}>
      <div className="px-6 pt-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {org?.name ?? 'Organization settings'}
        </h1>
      </div>
      {orgPending && <Skeleton className="m-6 h-48" />}
      {org && (
        <Tabs defaultValue="details" className="mt-4 flex min-h-0 flex-1 flex-col">
          <TabsList className="px-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-0 p-6">
            {/* Keyed so switching orgs resets any edit in progress. */}
            <DetailsPanel key={org.id} org={org} role={myRole} canEdit={canEdit} />
          </TabsContent>
          <TabsContent
            value="members"
            className="mt-0 flex min-h-0 flex-1 flex-col space-y-0 data-[state=inactive]:hidden"
          >
            <MembersSheet org={org} myUserId={session.user.id} myRole={myRole} />
          </TabsContent>
        </Tabs>
      )}
    </Shell>
  );
}
