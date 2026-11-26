'use client';

import { useId, useRef, useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkFile, uploadFile, type AttachedFile } from '@/lib/files';

/**
 * A paperclip that picks files, uploads each to Zuko, and hands back what was stored. The server's
 * reason is shown beside the button when a file is refused; files that did upload are still returned.
 */
export function AttachButton({
  onUploaded,
  multiple = true,
  disabled,
  label = 'Attach files',
  children,
}: {
  onUploaded: (files: AttachedFile[]) => void | Promise<void>;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  children?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function pick(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (input.current) input.current.value = '';
    if (picked.length === 0) return;
    setError(undefined);
    setBusy(true);
    const stored: AttachedFile[] = [];
    const problems: string[] = [];
    for (const file of picked) {
      const problem = checkFile(file);
      if (problem) {
        problems.push(problem);
        continue;
      }
      try {
        stored.push(await uploadFile(file));
      } catch (e) {
        problems.push(`${file.name}: ${e instanceof Error ? e.message : 'upload failed'}`);
      }
    }
    try {
      if (stored.length > 0) await onUploaded(stored);
    } finally {
      setBusy(false);
      if (problems.length > 0) setError(problems.join('. '));
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        hidden
        multiple={multiple}
        tabIndex={-1}
        aria-label={label}
        data-testid="file-input"
        onChange={(event) => void pick(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size={children ? 'sm' : 'icon-sm'}
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Paperclip aria-hidden />}
        {children}
      </Button>
      {busy && (
        <output className="text-xs text-muted-foreground">Uploading…</output>
      )}
      {error && (
        <span id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
