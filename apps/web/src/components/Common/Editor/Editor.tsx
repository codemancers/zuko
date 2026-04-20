import React, { useEffect, useRef, memo } from 'react';
import EditorJS, { OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Table from '@editorjs/table';
import Checklist from '@editorjs/checklist';
import InlineCode from '@editorjs/inline-code';
import Code from '@editorjs/code';
import Quote from '@editorjs/quote';
import Marker from '@editorjs/marker';
import Warning from '@editorjs/warning';
import Delimiter from '@editorjs/delimiter';

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
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    if (!ejInstance.current) {
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

      ejInstance.current = editor;
    }

    return () => {
      isMounted.current = false;
      setTimeout(() => {
        if (!isMounted.current && ejInstance.current && ejInstance.current.destroy) {
          ejInstance.current.isReady
            .then(() => {
              try {
                ejInstance.current?.destroy();
              } catch (e) {
                console.warn('EditorJS destroy failed:', e);
              }
              ejInstance.current = null;
            })
            .catch((e) => console.error('Error destroying EditorJS:', e));
        }
      }, 0);
    };
  }, [holder, readOnly]);

  return (
    <div className="w-full">
      <div 
        id={holder} 
        className="max-w-none min-h-24 editor-js-container" 
      />
      <style jsx global>{`
        .editor-js-container {
          font-family: inherit;
        }
        .editor-js-container .ce-block__content {
          max-width: 100% !important;
        }
        .editor-js-container .ce-toolbar__content {
          max-width: 100% !important;
        }
        .editor-js-container .ce-paragraph {
          font-size: 1rem;
          line-height: 1.6;
          color: inherit;
        }
        /* Only show placeholder on the very first block, and only if it's empty */
        .editor-js-container .ce-block:first-child .ce-paragraph[data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #707684;
          opacity: 0.5;
          font-weight: normal;
          display: inline-block;
          vertical-align: top;
          pointer-events: none;
        }
        /* Hide placeholder for any subsequent blocks */
        .editor-js-container .ce-block:not(:first-child) .ce-paragraph[data-placeholder]::before {
          content: none !important;
        }
        /* Ensure placeholder disappears when focused */
        .editor-js-container .ce-paragraph[data-placeholder]:empty:focus::before {
          opacity: 0.3;
        }
        /* Style headers and other blocks to look consistent without 'prose' */
        .editor-js-container h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
        .editor-js-container h2 { font-size: 1.5em; font-weight: bold; margin: 0.75em 0; }
        .editor-js-container h3 { font-size: 1.17em; font-weight: bold; margin: 0.83em 0; }
        .editor-js-container ul { list-style-type: disc; padding-left: 40px; }
        .editor-js-container ol { list-style-type: decimal; padding-left: 40px; }
        
        .ce-popover {
          z-index: 50;
        }
      `}</style>
    </div>
  );
};

export const ensureOutputData = (val: any): OutputData => {
  if (typeof val === 'string' && val.trim() !== '') {
    return {
      blocks: [
        {
          type: 'paragraph',
          data: {
            text: val,
          },
        },
      ],
    };
  }
  if (val && typeof val === 'object' && Array.isArray(val.blocks)) {
    return val as OutputData;
  }
  return { blocks: [] };
};

export default memo(Editor);
