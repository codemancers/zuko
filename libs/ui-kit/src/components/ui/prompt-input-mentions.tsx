/**
 * WORKAROUND: Temporary mentions implementation using react-mentions library
 *
 * This component provides @mention functionality for PromptInput until upstream
 * support is available in Vercel AI Elements.
 *
 * TODO: Revert to upstream implementation once https://github.com/vercel/ai-elements/issues/179 is resolved
 * @see https://github.com/vercel/ai-elements/issues/179
 * @see https://github.com/vercel/ai-elements/issues/296
 */

'use client';

import * as React from 'react';
import { MentionsInput, Mention } from 'react-mentions';
import { cn } from '../../lib/utils';
import './prompt-input-mentions.css';

// ============================================================================
// Types
// ============================================================================

export interface MentionSuggestion {
  id: string | number;
  display: string;
  description?: string;
}

export interface MentionTriggerConfig {
  trigger: string;
  data: any; // Use any to avoid type conflicts with react-mentions
  markup?: string;
  displayTransform?: (id: any, display: string) => string;
  renderSuggestion?: (
    suggestion: any,
    search: string,
    highlightedDisplay: React.ReactNode,
    index: number,
    focused: boolean,
  ) => React.ReactNode;
}

export interface PromptInputMentionsProps {
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
  onKeyDown?: (
    event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => void;
  mentionTriggers?: MentionTriggerConfig[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  singleLine?: boolean;
}

// ============================================================================
// Default Styling for react-mentions
// ============================================================================

const defaultMentionsStyle = {
  control: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    width: '100%',
  },
  '&multiLine': {
    control: {
      minHeight: '4rem',
      maxHeight: '12rem',
      width: '100%',
    },
    highlighter: {
      padding: '0.75rem',
      border: '0',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box' as const,
    },
    input: {
      padding: '0.75rem',
      border: '0',
      outline: 'none',
      backgroundColor: 'transparent',
      resize: 'none' as const,
      width: '100%',
      boxSizing: 'border-box' as const,
      overflow: 'auto',
    },
  },
  suggestions: {
    list: {
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 'calc(var(--radius) - 2px)',
      fontSize: '0.875rem',
      boxShadow:
        '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      maxHeight: '200px',
      overflow: 'auto',
    },
    item: {
      padding: '0.5rem 0.75rem',
      borderBottom: '1px solid hsl(var(--border))',
      cursor: 'pointer',
      '&focused': {
        backgroundColor: 'hsl(var(--accent))',
      },
    },
  },
};

// ============================================================================
// Component
// ============================================================================

export const PromptInputMentions = React.forwardRef<
  HTMLTextAreaElement,
  PromptInputMentionsProps
>(
  (
    {
      value = '',
      onChange,
      onKeyDown,
      mentionTriggers = [],
      className,
      placeholder,
      disabled,
      singleLine = false,
    },
    ref,
  ) => {
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleChange = React.useCallback(
      (event: any, newValue: string) => {
        onChange?.({ target: { value: newValue } });
      },
      [onChange],
    );

    // Forward onKeyDown events via useEffect with capture phase
    // This allows parent components to handle keyboard shortcuts like Shift+Enter
    React.useEffect(() => {
      const container = containerRef.current;
      if (!container || !onKeyDown) return;

      const handleKeyDownCapture = (event: KeyboardEvent) => {
        // Call external handler (convert to React synthetic event)
        if (event.target instanceof HTMLElement) {
          const syntheticEvent = event as any;
          onKeyDown(syntheticEvent);
        }
      };

      // Attach to container with capture phase to intercept before react-mentions
      container.addEventListener('keydown', handleKeyDownCapture, true);

      return () => {
        container.removeEventListener('keydown', handleKeyDownCapture, true);
      };
    }, [onKeyDown]);

    return (
      <div ref={containerRef} data-mentions-container className="w-full">
        <MentionsInput
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          singleLine={singleLine}
          className={cn('w-full', className)}
          style={defaultMentionsStyle}
          inputRef={ref as any}
        >
          {mentionTriggers.map((config) => (
            <Mention
              key={config.trigger}
              trigger={config.trigger}
              data={config.data}
              markup={
                config.markup ||
                `${config.trigger}[__display__](${config.trigger}__id__)`
              }
              displayTransform={
                config.displayTransform ||
                ((id, display) => `${config.trigger}${display}`)
              }
              renderSuggestion={config.renderSuggestion as any}
              appendSpaceOnAdd
            />
          ))}
        </MentionsInput>
      </div>
    );
  },
);

PromptInputMentions.displayName = 'PromptInputMentions';
