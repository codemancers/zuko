'use client';

import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useSheetCellEditing } from '@codemancers/sheets';
import { AttachButton } from '@/components/files/attach-button';
import { FileChip } from '@/components/files/file-chip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AttachedFile } from '@/lib/files';

/** The most files one field holds; the server enforces the same. */
export const MAX_FILES_PER_FIELD = 20;

/** The ids a staged value holds: a list for a field that holds many, one id (or blank) otherwise. */
const idsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : value === undefined || value === null || value === '' ? [] : [String(value)];

/**
 * A file field edited in place: the file names show in the cell, and clicking opens a panel to
 * attach more, open one or take one off. Each change is saved at once, as ids (never file contents).
 */
export function FileCell({
  label,
  rowLabel,
  value,
  many,
}: {
  label: string;
  rowLabel: string;
  value: AttachedFile[];
  many: boolean;
}) {
  const cell = useSheetCellEditing();
  // What was uploaded in this panel, so a file shows by name before the saved row comes back.
  const [uploaded, setUploaded] = useState<AttachedFile[]>([]);
  const known = new Map([...value, ...uploaded].map((file) => [file.id, file]));
  const staged = cell.stagedValue ?? cell.refusedValue;
  const ids = staged === undefined ? value.map((file) => file.id) : idsOf(staged);
  const files = ids.flatMap((id) => known.get(id) ?? []);
  const full = many && ids.length >= MAX_FILES_PER_FIELD;
  const save = (next: string[]) => cell.stage(many ? next : (next[0] ?? ''));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} of ${rowLabel}`}
          className="flex h-8 w-full items-center gap-1 overflow-hidden px-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Paperclip data-slot="link-add" className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
          <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-xs">
            {files.map((file) => (
              <span key={file.id} className="max-w-40 shrink-0 truncate rounded bg-secondary px-1.5 py-0.5">
                {file.filename}
              </span>
            ))}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {label} of {rowLabel}
        </p>
        {files.length > 0 && (
          <ul className="mb-2 flex flex-col gap-1.5" aria-label={label}>
            {files.map((file) => (
              <li key={file.id}>
                <FileChip file={file} onRemove={() => void save(ids.filter((id) => id !== file.id))} />
              </li>
            ))}
          </ul>
        )}
        {full ? (
          <p className="text-xs text-muted-foreground">This field holds at most {MAX_FILES_PER_FIELD} files.</p>
        ) : (
          <AttachButton
            multiple={many}
            label={`Attach to ${label}`}
            onUploaded={async (stored) => {
              setUploaded((current) => [...current, ...stored]);
              await save(many ? [...ids, ...stored.map((file) => file.id)] : [stored[stored.length - 1].id]);
            }}
          >
            {files.length > 0 && !many ? 'Replace' : 'Attach'}
          </AttachButton>
        )}
      </PopoverContent>
    </Popover>
  );
}
