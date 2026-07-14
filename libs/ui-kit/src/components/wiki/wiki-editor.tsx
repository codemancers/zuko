/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../../types/editorjs__plugins.d.ts" />
/// <reference path="../../types/editorjs__wiki-plugins.d.ts" />
/* eslint-enable @typescript-eslint/triple-slash-reference */
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type EditorJS from '@editorjs/editorjs';
import type { OutputData } from '@editorjs/editorjs';
import dynamic from 'next/dynamic';
import { cn } from '../../lib/utils';

export interface WikiEditorProps {
  data?: OutputData;
  onChange?: (data: OutputData) => void;
  onReady?: () => void;
  readOnly?: boolean;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

const WikiEditorComponent = ({
  data,
  onChange,
  onReady,
  readOnly = false,
  placeholder = 'Start writing...',
  minHeight = 200,
  className,
}: WikiEditorProps) => {
  const editorRef = useRef<EditorJS | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const initializingRef = useRef(false);
  const initialDataRef = useRef(data);

  // Callbacks live in refs so their identity NEVER re-runs the init effect.
  // Parents passing inline handlers (onSaveStart={() => …}) used to cascade
  // into a destroy/re-init here mid-save, resurrecting stale initial data
  // and wiping whatever the user had typed.
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onChangeRef.current = onChange;
    onReadyRef.current = onReady;
  });
  const holderIdRef = useRef(
    `wiki-editor-${Math.random().toString(36).substr(2, 9)}`,
  );

  const initializeEditor = useCallback(async () => {
    if (!holderRef.current) return;
    if (editorRef.current || initializingRef.current) return;
    initializingRef.current = true;

    try {
      const EditorJS = (await import('@editorjs/editorjs')).default;
      const Header = (await import('@editorjs/header')).default;
      const List = (await import('@editorjs/list')).default;
      const Code = (await import('@editorjs/code')).default;
      const Quote = (await import('@editorjs/quote')).default;
      const Delimiter = (await import('@editorjs/delimiter')).default;
      const InlineCode = (await import('@editorjs/inline-code')).default;
      const Marker = (await import('@editorjs/marker')).default;
      const Table = (await import('@editorjs/table')).default;
      const Warning = (await import('@editorjs/warning')).default;
      const Embed = (await import('@editorjs/embed')).default;

      editorRef.current = new EditorJS({
        holder: holderIdRef.current,
        data: initialDataRef.current || undefined,
        readOnly,
        placeholder,
        minHeight,
        tools: {
          header: {
            class: Header as never,
            config: { levels: [2, 3, 4], defaultLevel: 2 },
            inlineToolbar: true,
          },
          list: {
            class: List as never,
            inlineToolbar: true,
            config: { defaultStyle: 'unordered' },
          },
          code: { class: Code as never },
          quote: { class: Quote as never, inlineToolbar: true },
          delimiter: Delimiter as never,
          inlineCode: InlineCode as never,
          marker: Marker as never,
          table: {
            class: Table as never,
            inlineToolbar: true,
            config: { withHeadings: true },
          },
          warning: { class: Warning as never, inlineToolbar: true },
          embed: { class: Embed as never },
        },
        onChange: async () => {
          if (onChangeRef.current && editorRef.current) {
            try {
              onChangeRef.current(await editorRef.current.save());
            } catch (e) {
              console.error('WikiEditor save failed:', e);
            }
          }
        },
        onReady: () => {
          setIsReady(true);
          onReadyRef.current?.();
        },
      });
    } catch (error) {
      console.error('WikiEditor initialization failed:', error);
    }
    // Callbacks intentionally excluded — read via refs above so changing
    // parent handler identity can't tear down a live editing session.
  }, [placeholder, readOnly, minHeight]);

  useEffect(() => {
    initializeEditor();
    return () => {
      if (editorRef.current?.destroy) {
        try {
          editorRef.current.destroy();
          editorRef.current = null;
          setIsReady(false);
          initializingRef.current = false;
        } catch {
          initializingRef.current = false;
        }
      }
    };
  }, [initializeEditor]);

  return (
    <div
      id={holderIdRef.current}
      ref={holderRef}
      data-testid="wiki-editor"
      className={cn(
        'editor-js-container transition-all',
        !isReady && 'opacity-50',
        className,
      )}
      style={{ minHeight: `${minHeight}px` }}
    />
  );
};

export const WikiEditor = dynamic(() => Promise.resolve(WikiEditorComponent), {
  ssr: false,
  loading: () => (
    <div className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
      Loading editor...
    </div>
  ),
}) as typeof WikiEditorComponent;

export type { OutputData };
