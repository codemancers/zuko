'use client';

import React, { useEffect, useRef, memo } from 'react';
import EditorJS, { OutputData } from '@editorjs/editorjs';

interface EditorProps {
  data?: OutputData;
  onChange?: (data: OutputData) => void;
  onReady?: (instance: EditorJS) => void;
  holder: string;
  placeholder?: string;
  readOnly?: boolean;
}

const Editor = ({
  data,
  onChange,
  onReady,
  holder,
  placeholder = 'Start writing...',
  readOnly = false,
}: EditorProps) => {
  const ejInstance = useRef<EditorJS | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const initEditor = async () => {
      // Import tools dynamically to avoid SSR issues
      const Header = (await import('@editorjs/header')).default;
      const List = (await import('@editorjs/list')).default;
      const Table = (await import('@editorjs/table')).default;
      const Checklist = (await import('@editorjs/checklist')).default;
      const InlineCode = (await import('@editorjs/inline-code')).default;
      const Code = (await import('@editorjs/code')).default;
      const Quote = (await import('@editorjs/quote')).default;
      const Marker = (await import('@editorjs/marker')).default;
      const Warning = (await import('@editorjs/warning')).default;
      const Delimiter = (await import('@editorjs/delimiter')).default;

      if (isCancelled) {
        return; // Do not instantiate if unmounted during the async imports
      }

      const editor = new EditorJS({
        holder: holder,
        data: data,
        readOnly: readOnly,
        placeholder: placeholder,
        tools: {
          header: {
            class: Header as unknown as EditorJS.ToolConstructable,
            inlineToolbar: ['link'],
          },
          list: {
            class: List as unknown as EditorJS.ToolConstructable,
            inlineToolbar: true,
          },
          table: {
            class: Table as unknown as EditorJS.ToolConstructable,
            inlineToolbar: true,
          },
          checklist: {
            class: Checklist as unknown as EditorJS.ToolConstructable,
            inlineToolbar: true,
          },
          inlineCode: InlineCode as unknown as EditorJS.ToolConstructable,
          code: Code as unknown as EditorJS.ToolConstructable,
          quote: {
            class: Quote as unknown as EditorJS.ToolConstructable,
            inlineToolbar: true,
          },
          marker: Marker,
          warning: Warning,
          delimiter: Delimiter,
        },
        onReady: () => {
          if (isCancelled) {
            editor.destroy();
            return;
          }
          ejInstance.current = editor;
          onReady?.(editor);
        },
        onChange: async () => {
          if (onChange) {
            const content = await editor.save();
            onChange(content);
          }
        },
        autofocus: false,
      });
    };

    if (!ejInstance.current) {
      initEditor();
    }

    return () => {
      isCancelled = true;
      if (ejInstance.current && ejInstance.current.destroy) {
        try {
          ejInstance.current.destroy();
        } catch (e) {
          console.error('Error destroying EditorJS:', e);
        }
        ejInstance.current = null;
      }
    };
  }, []); // Remove dependencies to only run once on mount

  return (
    <div className="w-full">
      <div 
        id={holder} 
        className="prose prose-zinc dark:prose-invert max-w-none min-h-[100px] editor-js-container" 
      />
      <style jsx global>{`
        .editor-js-container .ce-block__content {
          max-width: 100% !important;
        }
        .editor-js-container .ce-toolbar__content {
          max-width: 100% !important;
        }
        .editor-js-container .ce-paragraph {
          font-size: 1rem;
          line-height: 1.6;
        }
        .ce-popover {
          z-index: 50;
        }
      `}</style>
    </div>
  );
};

export default memo(Editor);
