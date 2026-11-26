'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AttachButton } from '@/components/files/attach-button';
import { FileChip } from '@/components/files/file-chip';
import { Field, FieldLabel } from '@/components/ui/field';
import { ApiError, api } from '@/lib/api';
import { filesOf, type AttachedFile } from '@/lib/files';
import { MAX_FILES_PER_FIELD } from '@/components/records/file-cell';
import { useState } from 'react';
import type { FieldDef, RecordRow } from '@/lib/records';

interface Attachment {
  file: AttachedFile;
  source: { type: 'field'; field: string; label: string } | { type: 'comment'; comment_id: string };
  attached_at: string;
  attached_by: { id: string; name: string | null } | null;
}

const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * The files on a record in the drawer: each file field to attach to or take files off, and below
 * them everything attached to the record, through its fields and its comments.
 */
export function RecordFiles({
  object,
  recordId,
  fields,
  properties,
  version,
  onChanged,
}: {
  object: string;
  recordId: string;
  fields: FieldDef[];
  properties: Record<string, unknown>;
  /** Changes whenever the record or its comments do, to reload the list. */
  version: string;
  onChanged: () => void;
}) {
  const fileFields = fields.filter((f) => f.type === 'FILE' && !f.read_only);
  const queries = useQueryClient();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  // What the record holds now. The parent's copy can lag a save (a record opened from outside the sheet comes
  // from a query that is only marked stale), and the next edit is built from this, so until the copy catches
  // up the last save's response stands in for it. Otherwise attaching A and then B would send only B.
  const [latest, setLatest] = useState<RecordRow>();
  const current = latest?.id === recordId && latest.updated_at >= version ? latest.properties : properties;
  const base = `/api/v1/objects/${object}/records/${recordId}`;
  const list = useQuery({
    queryKey: ['record-files', object, recordId, version],
    queryFn: ({ signal }) => api<{ results: Attachment[] }>(`${base}/files`, { signal }),
  });

  async function change(field: FieldDef, ids: string[]) {
    setError(undefined);
    setSaving(true);
    try {
      setLatest(
        await api<RecordRow>(base, {
          method: 'PATCH',
          json: { properties: { [field.name]: field.config.many ? (ids.length ? ids : null) : (ids[0] ?? null) } },
        }),
      );
      await queries.invalidateQueries({ queryKey: ['record-files', object, recordId] });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change the files');
    } finally {
      setSaving(false);
    }
  }

  const results = list.data?.results ?? [];
  if (fileFields.length === 0 && results.length === 0 && !list.isPending) return null;
  return (
    <section aria-label="Files" className="mt-6 flex flex-col gap-4 border-t pt-4">
      {fileFields.map((field) => {
        const files = filesOf(current[field.name]);
        const many = field.config.many === true;
        return (
          <Field key={field.name}>
            <FieldLabel>
              {field.label}
              {!many && <span className="font-normal text-muted-foreground"> · one at a time</span>}
            </FieldLabel>
            {files.length > 0 && (
              <ul className="flex flex-col gap-1.5" aria-label={field.label}>
                {files.map((file) => (
                  <li key={file.id}>
                    <FileChip
                      file={file}
                      disabled={saving}
                      onRemove={() => void change(field, files.filter((f) => f.id !== file.id).map((f) => f.id))}
                    />
                  </li>
                ))}
              </ul>
            )}
            {many && files.length >= MAX_FILES_PER_FIELD ? (
              <p className="text-xs text-muted-foreground">At most {MAX_FILES_PER_FIELD} files.</p>
            ) : (
              <AttachButton
                multiple={many}
                disabled={saving}
                label={`Attach to ${field.label}`}
                onUploaded={(stored) =>
                  change(field, many ? [...files.map((f) => f.id), ...stored.map((f) => f.id)] : [stored[stored.length - 1].id])
                }
              >
                {files.length > 0 && !many ? 'Replace' : 'Attach'}
              </AttachButton>
            )}
          </Field>
        );
      })}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div>
        <h3 className="mb-1.5 text-sm font-medium">All files on this record</h3>
        {list.isPending ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : list.isError ? (
          <p role="alert" className="text-xs text-destructive">
            {list.error instanceof Error ? list.error.message : 'Could not load the files'}
          </p>
        ) : results.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing attached yet.</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="All files on this record">
            {results.map((item) => (
              <li key={`${item.source.type}-${item.file.id}-${item.attached_at}`} className="flex flex-col gap-0.5">
                <FileChip file={item.file} />
                <span className="text-xs text-muted-foreground">
                  {item.source.type === 'field' ? item.source.label : 'Comment'}
                  {item.attached_by?.name ? ` · ${item.attached_by.name}` : ''} · {when.format(new Date(item.attached_at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
