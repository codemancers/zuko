'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { DetailsList, DetailField, DetailLabel } from '@/components/ui/details';
import { Badge } from '@/components/ui/badge';
import { authClient } from '@/lib/auth-client';

type Org = NonNullable<ReturnType<typeof authClient.useActiveOrganization>['data']>;

export const SAVE_DEBOUNCE_MS = 700;

/**
 * Notion-style: always an input, styled to read as plain text. It saves once typing pauses
 * (or on blur / Enter); Escape reverts. A tick appears beside the label once saved.
 */
export function EditableField({
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

  // Follow incoming saved values between edits; preserve a focused draft.
  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    if (!focused) {
      setDraft(value);
      setError(null);
    }
  }

  useEffect(() => {
    if (!focused) {
      draftRef.current = value;
      lastSaved.current = value;
    }
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
      <DetailLabel
        accessory={saved && <Check className="size-3.5 text-green-500" aria-label="Saved" />}
      >
        {label}
      </DetailLabel>
      <dd>
        <input
          aria-label={label}
          aria-invalid={!!error}
          value={draft}
          readOnly={!canEdit}
          onChange={(e) => change(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={async () => {
            const empty = !draftRef.current.trim();
            setFocused(false);
            await flush();
            // An empty value is never saved; put the last saved text back.
            if (empty) revert();
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

export function DetailsPanel({
  org,
  memberRole,
  canEdit,
}: {
  org: Org;
  memberRole: string;
  canEdit: boolean;
}) {
  const save = (data: { name?: string; slug?: string }) => async (): Promise<string | null> => {
    const { error } = await authClient.organization.update({ organizationId: org.id, data });
    return error ? (error.message ?? 'Could not save.') : null;
  };

  return (
    <DetailsList>
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
      <DetailField label="Created">
        {new Date(org.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
      </DetailField>
      <DetailField label="Members">{org.members.length}</DetailField>
      <DetailField label="Pending invites">
        {org.invitations.filter((i) => i.status === 'pending').length}
      </DetailField>
      <DetailField label="Your role">
        <Badge variant="secondary" className="capitalize">
          {memberRole}
        </Badge>
      </DetailField>
    </DetailsList>
  );
}
