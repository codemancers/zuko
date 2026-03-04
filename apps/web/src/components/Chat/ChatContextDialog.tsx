'use client';

import { EntitySelectorDialog } from '@zuko/ui-kit';
import { CHAT_ENTITY_DIALOG_LABELS } from '@/lib/constants';
import { useChatContextManager } from './ChatContextWrapper';

/**
 * Dialog for selecting contacts/companies to add as context
 * Must be used inside ChatContextProvider
 */
export const ChatContextDialog = () => {
  const contextManager = useChatContextManager();
  const type = contextManager.dialogConfig.type ?? 'contact';
  const labels = CHAT_ENTITY_DIALOG_LABELS[type] ?? CHAT_ENTITY_DIALOG_LABELS.contact;

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
