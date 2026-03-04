/**
 * WORKAROUND: Chat input with @mentions support using react-mentions
 *
 * This component integrates PromptInputMentions with ChatContextManager to provide
 * mention suggestions for contacts, companies, and deals.
 *
 * TODO: Remove when https://github.com/vercel/ai-elements/issues/179 is resolved
 * @see https://github.com/vercel/ai-elements/issues/179
 */

'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PromptInputMentions,
  type PromptInputMentionsProps,
  type MentionSuggestion,
  type MentionTriggerConfig,
} from '@zuko/ui-kit';
import { getContacts, getCompanies, getDeals } from '@/server/query-options';
import { UserIcon, BuildingIcon, Briefcase } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ChatEntityType = 'contact' | 'company' | 'deal';
export interface ChatMention {
  type: ChatEntityType;
  id: number;
  name: string;
}

export interface ChatInputWithMentionsProps extends Omit<
  PromptInputMentionsProps,
  'mentionTriggers'
> {
  onMentionsExtract?: (mentions: ChatMention[]) => void;
}

const MENTION_ICON_MAP: Record<ChatEntityType, typeof UserIcon> = {
  contact: UserIcon,
  company: BuildingIcon,
  deal: Briefcase,
};

// ============================================================================
// Mention Extraction Utility
// ============================================================================

/**
 * Extract mentions from the marked-up text
 * Example: "@[John Doe](@contact-123)" => { type: "contact", id: 123, name: "John Doe" }
 */
export function extractMentions(text: string): ChatMention[] {
  const mentionRegex = /@\[([^\]]+)\]\(@(contact|company|deal)-(\d+)\)/g;
  const mentions: ChatMention[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      type: match[2] as 'contact' | 'company' | 'deal',
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
  return text.replace(/@\[([^\]]+)\]\(@(contact|company|deal)-\d+\)/g, '@$1');
}

// ============================================================================
// Component
// ============================================================================

export const ChatInputWithMentions = React.forwardRef<
  HTMLTextAreaElement,
  ChatInputWithMentionsProps
>(({ onMentionsExtract, onChange, ...props }, ref) => {
  // Fetch contacts, companies, and deals
  const { data: contactsData } = useQuery(getContacts({ limit: 100 }));
  const { data: companiesData } = useQuery(getCompanies({ limit: 100 }));
  const { data: dealsData } = useQuery(getDeals({ limit: 100 }));

  // Custom suggestion renderer
  const renderSuggestion = React.useCallback(
    (
      suggestion: MentionSuggestion,
      _search: string,
      _highlightedDisplay: React.ReactNode,
      _index: number,
      _focused: boolean,
    ) => {
      const idStr = String(suggestion.id);
      const prefix = idStr.split('-')[0] as ChatMention['type'];
      const Icon = MENTION_ICON_MAP[prefix] ?? UserIcon;

      return (
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {suggestion.display}
            </div>
            {suggestion.description && (
              <div className="text-xs text-muted-foreground truncate">
                {suggestion.description}
              </div>
            )}
          </div>
        </div>
      );
    },
    [],
  );

  // Mention triggers configuration
  const mentionTriggers = React.useMemo<MentionTriggerConfig[]>(
    () => [
      {
        trigger: '@',
        data: (
          search: string,
          callback: (data: MentionSuggestion[]) => void,
        ) => {
          const searchLower = search.toLowerCase();

          // Combine contacts and companies
          const contactSuggestions: MentionSuggestion[] =
            contactsData?.contacts.map((contact) => ({
              id: `contact-${contact.id}`,
              display: contact.name,
              description: contact.email || contact.phone,
            })) || [];

          const companySuggestions: MentionSuggestion[] =
            companiesData?.companies.map((company) => ({
              id: `company-${company.id}`,
              display: company.companyName,
              description: company.website,
            })) || [];

          const dealSuggestions: MentionSuggestion[] =
            dealsData?.deals.map((deal) => ({
              id: `deal-${deal.id}`,
              display: deal.title,
              description:
                deal.stage ||
                (deal.value != null
                  ? `${deal.currency || 'USD'} ${deal.value.toLocaleString()}`
                  : ''),
            })) || [];

          const allSuggestions = [
            ...contactSuggestions,
            ...companySuggestions,
            ...dealSuggestions,
          ];

          // Filter based on search
          const filtered = allSuggestions.filter(
            (s) =>
              s.display.toLowerCase().includes(searchLower) ||
              s.description?.toLowerCase().includes(searchLower),
          );

          callback(filtered);
        },
        renderSuggestion,
      },
    ],
    [contactsData, companiesData, dealsData, renderSuggestion],
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
    [onChange, onMentionsExtract],
  );

  return (
    <PromptInputMentions
      ref={ref}
      mentionTriggers={mentionTriggers}
      onChange={handleChange}
      {...props}
    />
  );
});

ChatInputWithMentions.displayName = 'ChatInputWithMentions';
