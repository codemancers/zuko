/**
 * WORKAROUND: Chat input with @mentions support using react-mentions
 *
 * This component integrates PromptInputMentions with ChatContextManager to provide
 * mention suggestions for contacts and accounts.
 *
 * TODO: Remove when https://github.com/vercel/ai-elements/issues/179 is resolved
 * @see https://github.com/vercel/ai-elements/issues/179
 */

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PromptInputMentions,
  type PromptInputMentionsProps,
  type MentionSuggestion,
  type MentionTriggerConfig,
} from "@zuko/ui-kit";
import { contactsApi } from "@/lib/api/contacts";
import { accountsApi } from "@/lib/api/accounts";
import { UserIcon, BuildingIcon } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface ChatMention {
  type: "contact" | "account";
  id: number;
  name: string;
}

export interface ChatInputWithMentionsProps extends Omit<PromptInputMentionsProps, 'mentionTriggers'> {
  onMentionsExtract?: (mentions: ChatMention[]) => void;
}

// ============================================================================
// Mention Extraction Utility
// ============================================================================

/**
 * Extract mentions from the marked-up text
 * Example: "@[John Doe](@contact-123)" => { type: "contact", id: 123, name: "John Doe" }
 */
export function extractMentions(text: string): ChatMention[] {
  const mentionRegex = /@\[([^\]]+)\]\(@(contact|account)-(\d+)\)/g;
  const mentions: ChatMention[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      type: match[2] as "contact" | "account",
      id: parseInt(match[3], 10),
      name: match[1],
    });
  }

  return mentions;
}

/**
 * Remove mention markup and return plain text
 * Example: "@[John Doe](@contact-123)" => "@John Doe"
 */
export function stripMentionMarkup(text: string): string {
  return text.replace(/@\[([^\]]+)\]\(@(contact|account)-\d+\)/g, '@$1');
}

// ============================================================================
// Component
// ============================================================================

export const ChatInputWithMentions = React.forwardRef<HTMLTextAreaElement, ChatInputWithMentionsProps>(
  ({ onMentionsExtract, onChange, ...props }, ref) => {
    // Fetch contacts and accounts
    const { data: contactsData } = useQuery({
      queryKey: ["contacts", { limit: 100 }],
      queryFn: () => contactsApi.getContacts({ limit: 100 }),
    });

    const { data: accountsData } = useQuery({
      queryKey: ["accounts", { limit: 100 }],
      queryFn: () => accountsApi.getAccounts({ limit: 100 }),
    });

    // Custom suggestion renderer
    const renderSuggestion = React.useCallback(
      (
        suggestion: MentionSuggestion,
        _search: string,
        _highlightedDisplay: React.ReactNode,
        _index: number,
        _focused: boolean
      ) => {
        const isContact = String(suggestion.id).startsWith('contact-');
        const Icon = isContact ? UserIcon : BuildingIcon;

        return (
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{suggestion.display}</div>
              {suggestion.description && (
                <div className="text-xs text-muted-foreground truncate">{suggestion.description}</div>
              )}
            </div>
          </div>
        );
      },
      []
    );

    // Mention triggers configuration
    const mentionTriggers = React.useMemo<MentionTriggerConfig[]>(
      () => [
        {
          trigger: "@",
          data: (search: string, callback: (data: MentionSuggestion[]) => void) => {
            const searchLower = search.toLowerCase();

            // Combine contacts and accounts
            const contactSuggestions: MentionSuggestion[] =
              contactsData?.contacts.map((contact) => ({
                id: `contact-${contact.id}`,
                display: contact.name,
                description: contact.email || contact.phone,
              })) || [];

            const accountSuggestions: MentionSuggestion[] =
              accountsData?.accounts.map((account) => ({
                id: `account-${account.id}`,
                display: account.companyName,
                description: account.website,
              })) || [];

            const allSuggestions = [...contactSuggestions, ...accountSuggestions];

            // Filter based on search
            const filtered = allSuggestions.filter(
              (s) =>
                s.display.toLowerCase().includes(searchLower) ||
                s.description?.toLowerCase().includes(searchLower)
            );

            callback(filtered);
          },
          renderSuggestion,
        },
      ],
      [contactsData, accountsData, renderSuggestion]
    );

    // Handle change and extract mentions
    const handleChange = React.useCallback(
      (event: { target: { value: string } }) => {
        onChange?.(event);

        // Extract mentions and notify parent
        if (onMentionsExtract) {
          const mentions = extractMentions(event.target.value);
          onMentionsExtract(mentions);
        }
      },
      [onChange, onMentionsExtract]
    );

    return (
      <PromptInputMentions
        ref={ref}
        mentionTriggers={mentionTriggers}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

ChatInputWithMentions.displayName = "ChatInputWithMentions";
