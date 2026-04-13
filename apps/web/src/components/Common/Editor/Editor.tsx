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

  useEffect(() => {
    // Basic instantiation since tools are now imported at top-level
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

    return () => {
      if (ejInstance.current && ejInstance.current.destroy) {
        try {
          ejInstance.current.destroy();
        } catch (e) {
          console.error('Error destroying EditorJS:', e);
        }
        ejInstance.current = null;
      }
    };
  }, []);

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
