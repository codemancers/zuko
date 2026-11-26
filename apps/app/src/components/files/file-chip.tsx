'use client';

import { FileText, X } from 'lucide-react';
import { fileUrl, formatSize, type AttachedFile } from '@/lib/files';

/**
 * One attached file: its name and size, opening in a new tab (images and PDFs show, anything else
 * downloads). With `onRemove` it has a button to take the file off.
 */
export function FileChip({
  file,
  onRemove,
  disabled,
}: {
  file: AttachedFile;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/40 py-0.5 pl-1.5 pr-1 text-xs">
      <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <a
        href={fileUrl(file.id)}
        target="_blank"
        rel="noopener noreferrer"
        title={file.size > 0 ? `${file.filename} (${formatSize(file.size)})` : file.filename}
        className="min-w-0 truncate underline-offset-2 hover:underline"
      >
        {file.filename}
      </a>
      {file.size > 0 && <span className="shrink-0 text-muted-foreground">{formatSize(file.size)}</span>}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${file.filename}`}
          disabled={disabled}
          onClick={onRemove}
          className="rounded-full p-0.5 hover:bg-foreground/10 disabled:opacity-50"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  );
}
