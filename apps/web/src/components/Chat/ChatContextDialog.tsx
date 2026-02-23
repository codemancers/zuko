"use client";

import { EntitySelectorDialog } from "@zuko/ui-kit";
import { useChatContextManager } from "./ChatContextWrapper";

/**
 * Dialog for selecting contacts/accounts to add as context
 * Must be used inside ChatContextProvider
 */
export const ChatContextDialog = () => {
  const contextManager = useChatContextManager();

  return (
    <EntitySelectorDialog
      open={contextManager.dialogConfig.open}
      onOpenChange={contextManager.dialogConfig.onOpenChange}
      title={
        contextManager.dialogConfig.type === "contact"
          ? "Add Contacts"
          : "Add Accounts"
      }
      description={
        contextManager.dialogConfig.type === "contact"
          ? "Select contacts to add as context"
          : "Select accounts to add as context"
      }
      searchPlaceholder={`Search ${contextManager.dialogConfig.type}s...`}
      items={contextManager.dialogConfig.items}
      selectedIds={contextManager.dialogConfig.selectedIds}
      onSelectionChange={contextManager.dialogConfig.onSelectionChange}
      onConfirm={contextManager.dialogConfig.onConfirm}
      isLoading={contextManager.dialogConfig.isLoading}
    />
  );
};
