'use client';

import { EntitySelectorDialog } from '@zuko/ui-kit';
import { useChatContextManager } from './ChatContextWrapper';

const LABEL_MAP = {
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

/**
 * Dialog for selecting contacts/companies to add as context
 * Must be used inside ChatContextProvider
 */
export const ChatContextDialog = () => {
  const contextManager = useChatContextManager();
  const type = contextManager.dialogConfig.type ?? 'contact';
  const labels = LABEL_MAP[type] ?? LABEL_MAP.contact;

  return (
    <EntitySelectorDialog
      open={contextManager.dialogConfig.open}
      onOpenChange={contextManager.dialogConfig.onOpenChange}
      title={labels.title}
      description={labels.description}
      searchPlaceholder={`Search ${type}...`}
      items={contextManager.dialogConfig.items}
      selectedIds={contextManager.dialogConfig.selectedIds}
      onSelectionChange={contextManager.dialogConfig.onSelectionChange}
      onConfirm={contextManager.dialogConfig.onConfirm}
      isLoading={contextManager.dialogConfig.isLoading}
    />
  );
};
