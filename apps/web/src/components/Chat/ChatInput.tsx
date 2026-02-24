/**
 * Unified Chat Input Component
 *
 * Reusable chat input that supports:
 * - @mentions (contacts and companies)
 * - Shift+Enter submission
 * - Voice input
 * - File attachments
 * - Web search
 * - Chat context management
 * - AI streaming status
 */

'use client';

import type { ComponentProps } from 'react';
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputButton,
  PromptInputTools,
  usePromptInputReferencedSources,
} from '@zuko/ui-kit';
import { ImageIcon, GlobeIcon, MicIcon } from 'lucide-react';
import {
  ChatContextDisplay,
  type ChatEntity,
} from '@/components/Chat/ChatContextManager';
import { ChatContextProvider } from '@/components/Chat/ChatContextWrapper';
import { ChatContextMenuItems } from '@/components/Chat/ChatContextMenuItems';
import { ChatContextDialog } from '@/components/Chat/ChatContextDialog';
import {
  ChatInputWithMentions,
  stripMentionMarkup,
  type ChatMention,
} from '@/components/Chat/ChatInputWithMentions';
import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ChatInputProps {
  onSubmit: (msg: { text: string; files?: any[] }) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  initialContext?: ChatEntity[];
  onContextChange?: (entities: ChatEntity[]) => void;
  status?: ComponentProps<typeof PromptInputSubmit>['status'];
  onStop?: () => void;
}

// ============================================================================
// Inner Component (must be inside PromptInput context)
// ============================================================================

interface ChatInputInnerProps {
  placeholder: string;
  disabled: boolean;
  initialContext: ChatEntity[];
  onContextChange?: (entities: ChatEntity[]) => void;
  status?: ComponentProps<typeof PromptInputSubmit>['status'];
  onStop?: () => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  mentions: ChatMention[];
  setMentions: (mentions: ChatMention[]) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isRecording: boolean;
  handleVoiceInput: () => void;
  handleFileAttachment: () => void;
  handleWebSearch: () => void;
  onShiftEnterSubmit: () => void;
}

const ChatInputInner = ({
  placeholder,
  disabled,
  initialContext,
  onContextChange,
  status,
  onStop,
  inputValue,
  setInputValue,
  mentions,
  setMentions,
  textareaRef,
  isRecording,
  handleVoiceInput,
  handleFileAttachment,
  handleWebSearch,
  onShiftEnterSubmit,
}: ChatInputInnerProps) => {
  // Chat context state (updated by ChatContextProvider)
  const [_chatContext, setChatContext] = useState<ChatEntity[]>([]);

  // Access referenced sources to sync mentions as visual chips
  const { add, remove } = usePromptInputReferencedSources();

  // Track which source IDs were added by mention sync (to avoid removing manually added entities)
  const mentionSourceIdsRef = useRef<Set<string>>(new Set());

  // Track previous mentions to detect changes
  const prevMentionsRef = useRef<ChatMention[]>([]);

  // Notify parent about context changes
  const handleContextChange = useCallback(
    (entities: ChatEntity[]) => {
      setChatContext(entities);
      onContextChange?.(entities);
    },
    [onContextChange]
  );

  // Sync mentions to referenced sources (so they appear as visual chips)
  useEffect(() => {
    // Create sets for efficient comparison
    const currentMentionIds = new Set(mentions.map((m) => `${m.type}-${m.id}`));
    const prevMentionIds = new Set(
      prevMentionsRef.current.map((m) => `${m.type}-${m.id}`)
    );

    // Add new mentions (those in current but not in previous)
    mentions.forEach((mention) => {
      const sourceId = `${mention.type}-${mention.id}`;

      if (
        !prevMentionIds.has(sourceId) &&
        !mentionSourceIdsRef.current.has(sourceId)
      ) {
        console.log(
          '[ChatInput] Adding mention to context:',
          sourceId,
          mention.name
        );
        add({
          type: 'source-document',
          sourceId,
          mediaType: 'application/json',
          title: mention.name,
        });
        mentionSourceIdsRef.current.add(sourceId);
      }
    });

    // Remove mentions that are no longer in the textarea (those in previous but not in current)
    const sourcesToRemove: string[] = [];
    mentionSourceIdsRef.current.forEach((sourceId) => {
      if (!currentMentionIds.has(sourceId)) {
        sourcesToRemove.push(sourceId);
      }
    });

    sourcesToRemove.forEach((sourceId) => {
      console.log('[ChatInput] Removing mention from context:', sourceId);
      remove(sourceId);
      mentionSourceIdsRef.current.delete(sourceId);
    });

    // Update previous mentions ref
    prevMentionsRef.current = mentions;
  }, [mentions, add, remove]); // Removed 'sources' from deps to prevent infinite loop

  return (
    <ChatContextProvider
      onContextChange={handleContextChange}
      initialContext={initialContext}
    >
      <ChatInputWithMentions
        placeholder={placeholder}
        ref={textareaRef as any}
        disabled={disabled}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onMentionsExtract={setMentions}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey && !disabled) {
            e.preventDefault();
            onShiftEnterSubmit();
          }
        }}
      />
      <PromptInputFooter>
        <PromptInputTools>
          {/* Action Menu for file attachments and context */}
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger tooltip="Add attachments" />
            <PromptInputActionMenuContent>
              <PromptInputActionMenuItem onSelect={handleFileAttachment}>
                <ImageIcon className="mr-2 size-4" />
                Add photos or files
              </PromptInputActionMenuItem>
              <ChatContextMenuItems />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>

          {/* Context chips display - next to + icon */}
          <ChatContextDisplay />

          {/* Web search button */}
          <PromptInputButton
            tooltip="Search the web"
            onClick={handleWebSearch}
            size="sm"
          >
            <GlobeIcon className="mr-1.5 size-4" />
            Search
          </PromptInputButton>
        </PromptInputTools>

        <PromptInputTools>
          {/* Voice input button */}
          <PromptInputButton
            tooltip="Voice input"
            onClick={handleVoiceInput}
            variant={isRecording ? 'default' : 'ghost'}
          >
            <MicIcon
              className={`size-4 ${isRecording ? 'text-red-500' : ''}`}
            />
          </PromptInputButton>

          {/* Submit button */}
          <PromptInputSubmit status={status} onStop={onStop} />
        </PromptInputTools>
      </PromptInputFooter>

      {/* Entity Selector Dialog */}
      <ChatContextDialog />
    </ChatContextProvider>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ChatInput = ({
  onSubmit,
  placeholder = 'Ask anything... (try typing @ to mention)',
  disabled = false,
  initialContext = [],
  onContextChange,
  status,
  onStop,
}: ChatInputProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track mentions from input
  const [mentions, setMentions] = useState<ChatMention[]>([]);

  // Track context from ChatInputInner (includes mentions + manually added entities)
  const [currentContext, setCurrentContext] = useState<ChatEntity[]>([]);

  // Wrap onContextChange to also update local state
  const handleContextChangeWrapper = useCallback(
    (entities: ChatEntity[]) => {
      setCurrentContext(entities);
      onContextChange?.(entities);
    },
    [onContextChange]
  );

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join('');

        if (textareaRef.current) {
          // Trigger input event to update PromptInput state
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          )?.set;
          nativeInputValueSetter?.call(textareaRef.current, transcript);
          const event = new Event('input', { bubbles: true });
          textareaRef.current.dispatchEvent(event);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const handleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) {
      alert(
        'Speech recognition is not supported in your browser. Please use Chrome.'
      );
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  }, [isRecording]);

  const handleFileAttachment = useCallback(() => {
    alert('File attachment feature - to be implemented');
  }, []);

  const handleWebSearch = useCallback(() => {
    alert('Web search feature - to be implemented');
  }, []);

  const handleSubmitMessage = async (msg: { text: string; files?: any[] }) => {
    if (!msg.text.trim() || disabled) {
      return;
    }

    try {
      // currentContext already includes mentions (they're added as chips via useEffect in ChatInputInner)
      const contextEntities = currentContext.map((entity) => ({
        type: entity.type,
        id: entity.id,
      }));

      // Call parent's onSubmit with cleaned text and context
      await onSubmit({
        text: stripMentionMarkup(msg.text),
        files: msg.files,
        ...(contextEntities.length > 0 &&
          ({
            metadata: { contextEntities },
          } as any)),
      });

      // Clear input and mentions on successful submit
      setInputValue('');
      setMentions([]);
    } catch (error) {
      console.error('[ChatInput] Error submitting message:', error);
      throw error; // Re-throw so PromptInput doesn't clear the input on error
    }
  };

  // Handle Shift+Enter submission
  const handleShiftEnterSubmit = useCallback(() => {
    if (inputValue.trim() && !disabled) {
      handleSubmitMessage({ text: inputValue });
    }
  }, [inputValue, disabled, handleSubmitMessage]);

  return (
    <PromptInput onSubmit={handleSubmitMessage} accept="image/*" multiple>
      <ChatInputInner
        placeholder={placeholder}
        disabled={disabled}
        initialContext={initialContext}
        onContextChange={handleContextChangeWrapper}
        status={status}
        onStop={onStop}
        inputValue={inputValue}
        setInputValue={setInputValue}
        mentions={mentions}
        setMentions={setMentions}
        textareaRef={textareaRef}
        isRecording={isRecording}
        handleVoiceInput={handleVoiceInput}
        handleFileAttachment={handleFileAttachment}
        handleWebSearch={handleWebSearch}
        onShiftEnterSubmit={handleShiftEnterSubmit}
      />
    </PromptInput>
  );
};
