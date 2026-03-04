/**
 * Shared constants for chat context entity types (contact, company, deal).
 * Use these for labels and dialog copy across chat components and pages.
 */

export type ChatContextEntityType = 'contact' | 'company' | 'deal';

/** Display name for each entity type (e.g. for chips, fallbacks) */
export const CHAT_ENTITY_TYPE_LABEL: Record<ChatContextEntityType, string> = {
  contact: 'Contact',
  company: 'Company',
  deal: 'Deal',
};

/** Dialog title and description for the entity selector */
export const CHAT_ENTITY_DIALOG_LABELS: Record<
  ChatContextEntityType,
  { title: string; description: string }
> = {
  contact: {
    title: 'Add Contacts',
    description: 'Select contacts to add as context',
  },
  company: {
    title: 'Add Companies',
    description: 'Select companies to add as context',
  },
  deal: {
    title: 'Add Deals',
    description: 'Select deals to add as context',
  },
};
