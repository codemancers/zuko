"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserIcon, BuildingIcon } from "lucide-react";
import {
  ContextChip,
  EntityItem,
  usePromptInputReferencedSources,
} from "@zuko/ui-kit";
import { contactsApi, type Contact } from "@/lib/api/contacts";
import { accountsApi, type SalesAccount } from "@/lib/api/accounts";

// ============================================================================
// Types
// ============================================================================

export type ChatEntityType = "contact" | "account";

export interface ChatEntity {
  type: ChatEntityType;
  id: number;
  name: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Adapters: Domain → Generic
// ============================================================================

function contactToEntityItem(contact: Contact): EntityItem {
  return {
    id: `contact-${contact.id}`,
    label: contact.name,
    description: contact.email || contact.phone,
    icon: <UserIcon className="size-4" />,
    metadata: {
      type: "contact",
      entityId: contact.id,
      email: contact.email,
      phone: contact.phone,
      linkedinId: contact.linkedinId,
      notes: contact.notes,
    },
  };
}

function accountToEntityItem(account: SalesAccount): EntityItem {
  const contactCount = account._count?.contacts || 0;
  const description =
    account.website || `${contactCount} contact${contactCount !== 1 ? "s" : ""}`;

  return {
    id: `account-${account.id}`,
    label: account.companyName,
    description,
    icon: <BuildingIcon className="size-4" />,
    metadata: {
      type: "account",
      entityId: account.id,
      website: account.website,
      linkedinUrl: account.linkedinUrl,
      summary: account.summary,
    },
  };
}

function entityItemToChatEntity(item: EntityItem): ChatEntity {
  const type = item.metadata?.type as ChatEntityType;
  const entityId = item.metadata?.entityId as number;

  return {
    type,
    id: entityId,
    name: item.label,
    metadata: item.metadata || {},
  };
}

// ============================================================================
// Context Manager Component
// ============================================================================

export interface ChatContextManagerProps {
  onContextChange?: (entities: ChatEntity[]) => void;
}

export const ChatContextManager = ({
  onContextChange,
}: ChatContextManagerProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"contact" | "account" | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Use PromptInput's referenced sources hook - must be inside PromptInput context
  const referencedSources = usePromptInputReferencedSources();
  const { sources, add, remove } = referencedSources;

  // Fetch contacts and accounts
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts", { limit: 100 }],
    queryFn: () => contactsApi.getContacts({ limit: 100 }),
  });

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ["accounts", { limit: 100 }],
    queryFn: () => accountsApi.getAccounts({ limit: 100 }),
  });

  // Convert to generic EntityItem[]
  const contactItems = useMemo(
    () => contactsData?.contacts.map(contactToEntityItem) || [],
    [contactsData]
  );

  const accountItems = useMemo(
    () => accountsData?.accounts.map(accountToEntityItem) || [],
    [accountsData]
  );

  // Get current entities from sources
  const currentEntities = useMemo(() => {
    return sources.map((source) => ({
      id: source.id,
      type: (source as any).metadata?.type as ChatEntityType,
      entityId: (source as any).metadata?.entityId as number,
      label: (source as any).title || "",
    }));
  }, [sources]);

  // Handle dialog open
  const handleOpenDialog = useCallback((type: "contact" | "account") => {
    setDialogType(type);
    setSelectedIds([]);
    setDialogOpen(true);
  }, []);

  // Handle entity removal
  const handleRemove = useCallback(
    (sourceId: string) => {
      remove(sourceId);

      // Notify parent
      const updated = sources
        .filter((s) => s.id !== sourceId)
        .map((s) =>
          entityItemToChatEntity({
            id: s.id,
            label: (s as any).title || "",
            metadata: (s as any).metadata,
          })
        );
      onContextChange?.(updated);
    },
    [remove, sources, onContextChange]
  );

  // Handle dialog confirm
  const handleConfirm = useCallback(
    (selectedItems: EntityItem[]) => {
      // Convert to SourceDocumentUIPart format and add
      selectedItems.forEach((item) => {
        add({
          type: "source-document",
          sourceId: item.id,
          mediaType: "application/json",
          title: item.label,
          ...(item.metadata && { metadata: item.metadata }),
        });
      });

      // Notify parent
      const allEntities = [
        ...currentEntities.map((e) =>
          entityItemToChatEntity({
            id: `${e.type}-${e.entityId}`,
            label: e.label,
            metadata: (sources.find((s) => s.id === e.id) as any)?.metadata || {},
          })
        ),
        ...selectedItems.map(entityItemToChatEntity),
      ];
      onContextChange?.(allEntities);

      setDialogOpen(false);
      setDialogType(null);
      setSelectedIds([]);
    },
    [add, currentEntities, sources, onContextChange]
  );

  // Get dialog items based on type
  const dialogItems =
    dialogType === "contact"
      ? contactItems
      : dialogType === "account"
        ? accountItems
        : [];

  const isDialogLoading =
    dialogType === "contact" ? contactsLoading : accountsLoading;

  return {
    currentEntities,
    handleOpenDialog,
    handleRemove,
    dialogConfig: {
      open: dialogOpen,
      onOpenChange: setDialogOpen,
      type: dialogType,
      items: dialogItems,
      selectedIds,
      onSelectionChange: setSelectedIds,
      onConfirm: handleConfirm,
      isLoading: isDialogLoading,
    },
  };
};

// ============================================================================
// Chat Context Display Component
// ============================================================================

export const ChatContextDisplay = () => {
  const { sources, remove } = usePromptInputReferencedSources();

  if (sources.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => {
        const type = (source as any).metadata?.type as ChatEntityType;
        const color = type === "contact" ? "blue" : "purple";
        const icon =
          type === "contact" ? (
            <UserIcon className="size-3.5" />
          ) : (
            <BuildingIcon className="size-3.5" />
          );

        return (
          <ContextChip
            key={source.id}
            id={source.id}
            label={(source as any).title || ""}
            icon={icon}
            color={color}
            onRemove={(id) => remove(id)}
          />
        );
      })}
    </div>
  );
};

// ============================================================================
// Entity Selector Trigger Component
// ============================================================================

export interface EntitySelectorTriggerProps {
  onSelectType: (type: "contact" | "account") => void;
}

export const EntitySelectorTrigger = ({
  onSelectType,
}: EntitySelectorTriggerProps) => {
  return (
    <>
      <button
        type="button"
        onClick={() => onSelectType("contact")}
        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
      >
        <UserIcon className="size-4" />
        Add contact
      </button>
      <button
        type="button"
        onClick={() => onSelectType("account")}
        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
      >
        <BuildingIcon className="size-4" />
        Add account
      </button>
    </>
  );
};
