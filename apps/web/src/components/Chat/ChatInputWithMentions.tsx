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
  usePromptInputReferencedSources,
  type PromptInputMentionsProps,
  type MentionSuggestion,
  type MentionTriggerConfig,
} from '@zuko/ui-kit';
import { getContacts, getCompanies, getDeals } from '@/server/query-options';
import { UserIcon, BuildingOfficeIcon, BriefcaseIcon } from '@heroicons/react/24/outline';

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
  company: BuildingOfficeIcon,
  deal: BriefcaseIcon,
};

const HEADER_IDS = {
  contact: '__header_contact__',
  company: '__header_company__',
  deal: '__header_deal__',
} as const;

function isHeaderId(id: string | number): boolean {
  return String(id).startsWith('__header_');
}

/** Strip header "mentions" if user accidentally selects a section header */
function stripHeaderMentions(value: string): string {
  return value.replace(/@\[[^\]]+\]\(@__header_[^)]+\)\s?/g, '');
}

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

  // Entities already in context (from + button or previous @mentions) – exclude from list
  const { sources } = usePromptInputReferencedSources();
  const contextEntityIds = React.useMemo(
    () => new Set(sources.map((s) => s.id)),
    [sources],
  );

  // Custom suggestion renderer (item row or section header)
  const renderSuggestion = React.useCallback(
    (
      suggestion: MentionSuggestion,
      _search: string,
      _highlightedDisplay: React.ReactNode,
      _index: number,
      _focused: boolean,
    ) => {
      const idStr = String(suggestion.id);
      if (isHeaderId(idStr)) {
        return (
          <div
            data-section-header
            className="sticky top-0 z-10 -my-2 -mx-3 w-[calc(100%+1.5rem)] bg-popover px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground select-none"
            role="presentation"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {suggestion.display}
          </div>
        );
      }
      const prefix = idStr.split('-')[0] as ChatMention['type'];
      const Icon = MENTION_ICON_MAP[prefix] ?? UserIcon;

      return (
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0 flex items-baseline gap-2 text-sm truncate">
            <span className="font-medium truncate">{suggestion.display}</span>
            {suggestion.description && (
              <>
                <span className="text-muted-foreground shrink-0">·</span>
                <span className="text-muted-foreground truncate">
                  {suggestion.description}
                </span>
              </>
            )}
          </div>
        </div>
      );
    },
    [],
  );

  // Mention triggers configuration: grouped by Contacts, Companies, Deals
  const mentionTriggers = React.useMemo<MentionTriggerConfig[]>(
    () => [
      {
        trigger: '@',
        data: (
          search: string,
          callback: (data: MentionSuggestion[]) => void,
        ) => {
          // Show list only after user types at least 3 characters after @
          if (search.length < 3) {
            callback([]);
            return;
          }
          const searchLower = search.toLowerCase();
          const match = (s: { display: string; description?: string }) =>
            s.display.toLowerCase().includes(searchLower) ||
            (s.description?.toLowerCase().includes(searchLower) ?? false);

          const contactSuggestions: MentionSuggestion[] =
            contactsData?.contacts
              .filter((contact) => !contextEntityIds.has(`contact-${contact.id}`))
              .map((contact) => ({
                id: `contact-${contact.id}`,
                display: contact.name,
                description: contact.email || contact.phone,
              })) || [];
          const filteredContacts = contactSuggestions.filter(match);

          const companySuggestions: MentionSuggestion[] =
            companiesData?.companies
              .filter(
                (company) => !contextEntityIds.has(`company-${company.id}`),
              )
              .map((company) => ({
                id: `company-${company.id}`,
                display: company.companyName,
                description: company.website,
              })) || [];
          const filteredCompanies = companySuggestions.filter(match);

          const dealSuggestions: MentionSuggestion[] =
            dealsData?.deals
              .filter((deal) => !contextEntityIds.has(`deal-${deal.id}`))
              .map((deal) => ({
                id: `deal-${deal.id}`,
                display: deal.title,
                description:
                  deal.stage ||
                  (deal.value != null
                    ? `${deal.currency || 'USD'} ${deal.value.toLocaleString()}`
                    : ''),
              })) || [];
          const filteredDeals = dealSuggestions.filter(match);

          const grouped: MentionSuggestion[] = [];
          if (filteredContacts.length > 0) {
            grouped.push({
              id: HEADER_IDS.contact,
              display: 'Contacts',
              description: '',
            });
            grouped.push(...filteredContacts);
          }
          if (filteredCompanies.length > 0) {
            grouped.push({
              id: HEADER_IDS.company,
              display: 'Companies',
              description: '',
            });
            grouped.push(...filteredCompanies);
          }
          if (filteredDeals.length > 0) {
            grouped.push({
              id: HEADER_IDS.deal,
              display: 'Deals',
              description: '',
            });
            grouped.push(...filteredDeals);
          }

          callback(grouped);
        },
        renderSuggestion,
      },
    ],
    [contactsData, companiesData, dealsData, contextEntityIds, renderSuggestion],
  );

  // Handle change: strip section-header "mentions" if selected, then notify parent
  const handleChange = React.useCallback(
    (event: { target: { value: string } }) => {
      const value = stripHeaderMentions(event.target.value);
      if (value !== event.target.value) {
        event = { target: { value } };
      }
      onChange?.(event);

      if (onMentionsExtract) {
        const mentions = extractMentions(value);
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
