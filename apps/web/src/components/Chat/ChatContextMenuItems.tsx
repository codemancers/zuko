'use client';

import { PromptInputActionMenuItem } from '@zuko/ui-kit';
import { UserIcon, BuildingIcon, Briefcase } from 'lucide-react';
import { useChatContextManager } from './ChatContextWrapper';

/**
 * Menu items for adding contacts/companies as context
 * Must be used inside ChatContextProvider
 */
export const ChatContextMenuItems = () => {
  const contextManager = useChatContextManager();

  return (
    <>
      <PromptInputActionMenuItem
        onSelect={() => contextManager.handleOpenDialog('contact')}
      >
        <UserIcon className="mr-2 size-4" />
        Add contact
      </PromptInputActionMenuItem>
      <PromptInputActionMenuItem
        onSelect={() => contextManager.handleOpenDialog('company')}
      >
        <BuildingIcon className="mr-2 size-4" />
        Add company
      </PromptInputActionMenuItem>
      <PromptInputActionMenuItem
        onSelect={() => contextManager.handleOpenDialog('deal')}
      >
        <Briefcase className="mr-2 size-4" />
        Add deal
      </PromptInputActionMenuItem>
    </>
  );
};
