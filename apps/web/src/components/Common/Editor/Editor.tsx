import React, { useEffect, useRef, memo } from 'react';
import type { OutputData } from '@editorjs/editorjs';
import EditorJS from '@editorjs/editorjs';
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
import './Editor.css';

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
