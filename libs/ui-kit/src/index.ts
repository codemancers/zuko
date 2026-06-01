export * from './lib/ui-kit';
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsPanels,
  TabsContent,
} from './lib/tabs';
export * from './lib/utils';
// Export Headless UI primitives button (preferred over shadcn)
export { Button } from './lib/button';
// Keep shadcn button available as ShadcnButton if needed
export { Button as ShadcnButton, buttonVariants } from './components/ui/button';

// AI Elements - Conversation
export {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  ConversationDownload,
} from './components/ui/conversation';

// AI Elements - Message
export {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  MessageBranch,
  MessageBranchContent,
  MessageBranchSelector,
  MessageBranchPrevious,
  MessageBranchNext,
  MessageBranchPage,
  MessageResponse,
  MessageToolbar,
} from './components/ui/message';

// AI Elements - Prompt Input
export {
  PromptInput,
  PromptInputProvider,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputHeader,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputSubmit,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
  usePromptInputAttachments,
  usePromptInputReferencedSources,
} from './components/ui/prompt-input';

// WORKAROUND: Temporary mentions support - remove when https://github.com/vercel/ai-elements/issues/179 is resolved
export { PromptInputMentions } from './components/ui/prompt-input-mentions';
export type {
  PromptInputMentionsProps,
  MentionSuggestion,
  MentionTriggerConfig,
} from './components/ui/prompt-input-mentions';

// AI Elements - Context Components
export { ContextChip } from './components/ui/context-chip';
export type { ContextChipProps } from './components/ui/context-chip';
export { EntitySelectorDialog } from './components/ui/entity-selector-dialog';
export type {
  EntityItem,
  EntitySelectorDialogProps,
} from './components/ui/entity-selector-dialog';

// Legacy shadcn/ui components
export { Textarea } from './components/ui/textarea';
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './components/ui/tooltip';
export { Spinner } from './components/ui/spinner';
export { AuthLayout } from './layouts/auth-layout';
export { SidebarLayout } from './layouts/sidebar-layout';

export {
  Combobox,
  ComboboxOption,
  ComboboxLabel,
  ComboboxDescription,
} from './lib/combobox';

export { Switch, SwitchGroup, SwitchField } from './lib/switch';
export { MultiSelect, MultiCombobox } from './lib/multi-select';
export type { MultiSelectOption } from './lib/multi-select';
