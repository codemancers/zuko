'use client';

import { PromptInputActionMenuItem } from '@zuko/ui-kit';
import {
  UserIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline';
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
        <BuildingOfficeIcon className="mr-2 size-4" />
        Add company
      </PromptInputActionMenuItem>
      <PromptInputActionMenuItem
        onSelect={() => contextManager.handleOpenDialog('deal')}
      >
        <BriefcaseIcon className="mr-2 size-4" />
        Add deal
      </PromptInputActionMenuItem>
    </>
  );
};
