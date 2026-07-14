'use client';

import { useCallback, useRef, useEffect } from 'react';
import { WikiEditor } from './wiki-editor';
import type { OutputData } from '@editorjs/editorjs';
import { cn } from '../../lib/utils';

export interface WikiPageProps {
  pageId?: number;
  initialData?: OutputData;
  onSave?: (data: OutputData) => Promise<void>;
  readOnly?: boolean;
  placeholder?: string;
  autoSaveDelay?: number;
  className?: string;
  minHeight?: number;
  /** Fired when a debounced save begins — drives "Saving…" indicators. */
  onSaveStart?: () => void;
  /** Fired after a save resolves — drives "Saved ✓" indicators. */
  onSaveComplete?: () => void;
  /** Fired when a save rejects (the error is still logged here). */
  onSaveError?: (error: unknown) => void;
}

export const WikiPage = ({
  pageId,
  initialData,
  onSave,
  readOnly = false,
  placeholder = 'Write something important...',
  autoSaveDelay = 2000,
  className,
  minHeight = 200,
  onSaveStart,
  onSaveComplete,
  onSaveError,
}: WikiPageProps) => {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<OutputData | null>(null);

  const performSave = useCallback(
    async (data: OutputData) => {
      if (!onSave || readOnly) return;
      try {
        onSaveStart?.();
        await onSave(data);
        pendingRef.current = null;
        onSaveComplete?.();
      } catch (e) {
        console.error('WikiPage save failed:', e);
        onSaveError?.(e);
      }
    },
    [onSave, readOnly, onSaveStart, onSaveComplete, onSaveError],
  );

  const handleChange = useCallback(
    (data: OutputData) => {
      pendingRef.current = data;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (!readOnly && onSave) {
        saveTimeoutRef.current = setTimeout(
          () => performSave(data),
          autoSaveDelay,
        );
      }
    },
    [autoSaveDelay, onSave, performSave, readOnly],
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (pendingRef.current && onSave && !readOnly) {
        performSave(pendingRef.current);
      }
    };
  }, [onSave, performSave, readOnly]);

  return (
    <div className={cn('relative', className)}>
      <WikiEditor
        key={`${pageId}-${readOnly ? 'ro' : 'rw'}`}
        data={initialData}
        onChange={handleChange}
        readOnly={readOnly}
        placeholder={placeholder}
        minHeight={minHeight}
      />
    </div>
  );
};
