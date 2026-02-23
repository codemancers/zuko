"use client";

import { PromptInputActionMenuItem } from "@zuko/ui-kit";
import { UserIcon, BuildingIcon } from "lucide-react";
import { useChatContextManager } from "./ChatContextWrapper";

/**
 * Menu items for adding contacts/accounts as context
 * Must be used inside ChatContextProvider
 */
export const ChatContextMenuItems = () => {
  const contextManager = useChatContextManager();

  return (
    <>
      <PromptInputActionMenuItem
        onSelect={() => contextManager.handleOpenDialog("contact")}
      >
        <UserIcon className="mr-2 size-4" />
        Add contact
      </PromptInputActionMenuItem>
      <PromptInputActionMenuItem
        onSelect={() => contextManager.handleOpenDialog("account")}
      >
        <BuildingIcon className="mr-2 size-4" />
        Add account
      </PromptInputActionMenuItem>
    </>
  );
};
