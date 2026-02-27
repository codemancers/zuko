'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserIcon, BuildingIcon } from 'lucide-react';
import {
  ContextChip,
  EntityItem,
  usePromptInputReferencedSources,
} from '@zuko/ui-kit';
import { contactsApi, type Contact } from '@/lib/api/contacts';
import { companiesApi, type SalesCompany } from '@/lib/api/companies';

// ============================================================================
// Types
// ============================================================================

export type ChatEntityType = 'contact' | 'company';

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
      type: 'contact',
      entityId: contact.id,
      email: contact.email,
      phone: contact.phone,
      linkedinId: contact.linkedinId,
      notes: contact.notes,
    },
  };
}

function companyToEntityItem(company: SalesCompany): EntityItem {
  const contactCount = company._count?.contacts || 0;
  const description =
    company.website ||
    `${contactCount} contact${contactCount !== 1 ? 's' : ''}`;

  return {
    id: `company-${company.id}`,
    label: company.companyName,
    description,
    icon: <BuildingIcon className="size-4" />,
    metadata: {
      type: 'company',
      entityId: company.id,
      website: company.website,
      linkedinUrl: company.linkedinUrl,
      summary: company.summary,
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
  const [dialogType, setDialogType] = useState<'contact' | 'company' | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Use PromptInput's referenced sources hook - must be inside PromptInput context
  const referencedSources = usePromptInputReferencedSources();
  const { sources, add, remove } = referencedSources;

  // Fetch contacts and companies
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts', { limit: 100 }],
    queryFn: () => contactsApi.getContacts({ limit: 100 }),
  });

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies', { limit: 100 }],
    queryFn: () => companiesApi.getCompanies({ limit: 100 }),
  });

  // Convert to generic EntityItem[]
  const contactItems = useMemo(
    () => contactsData?.contacts.map(contactToEntityItem) || [],
    [contactsData],
  );

  const companyItems = useMemo(
    () => companiesData?.companies.map(companyToEntityItem) || [],
    [companiesData],
  );

  // Get current entities from sources
  const currentEntities = useMemo(() => {
    return sources.map((source) => ({
      id: source.id,
      type: (source as any).metadata?.type as ChatEntityType,
      entityId: (source as any).metadata?.entityId as number,
      label: (source as any).title || '',
    }));
  }, [sources]);

  // Handle dialog open
  const handleOpenDialog = useCallback((type: 'contact' | 'company') => {
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
            label: (s as any).title || '',
            metadata: (s as any).metadata,
          }),
        );
      onContextChange?.(updated);
    },
    [remove, sources, onContextChange],
  );

  // Handle dialog confirm
  const handleConfirm = useCallback(
    (selectedItems: EntityItem[]) => {
      // Convert to SourceDocumentUIPart format and add
      selectedItems.forEach((item) => {
        add({
          type: 'source-document',
          sourceId: item.id,
          mediaType: 'application/json',
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
            metadata:
              (sources.find((s) => s.id === e.id) as any)?.metadata || {},
          }),
        ),
        ...selectedItems.map(entityItemToChatEntity),
      ];
      onContextChange?.(allEntities);

      setDialogOpen(false);
      setDialogType(null);
      setSelectedIds([]);
    },
    [add, currentEntities, sources, onContextChange],
  );

  // Get dialog items based on type
  const dialogItems =
    dialogType === 'contact'
      ? contactItems
      : dialogType === 'company'
        ? companyItems
        : [];

  const isDialogLoading =
    dialogType === 'contact' ? contactsLoading : companiesLoading;

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
        const color = type === 'contact' ? 'blue' : 'purple';
        const icon =
          type === 'contact' ? (
            <UserIcon className="size-3.5" />
          ) : (
            <BuildingIcon className="size-3.5" />
          );
        const rawLabel = (source as any).title ?? '';
        const label =
          typeof rawLabel === 'string' &&
          rawLabel &&
          !rawLabel.includes('undefined')
            ? rawLabel
            : type === 'contact'
              ? 'Contact'
              : 'Company';

        return (
          <ContextChip
            key={source.id}
            id={source.id}
            label={label}
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
  onSelectType: (type: 'contact' | 'company') => void;
}

export const EntitySelectorTrigger = ({
  onSelectType,
}: EntitySelectorTriggerProps) => {
  return (
    <>
      <button
        type="button"
        onClick={() => onSelectType('contact')}
        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
      >
        <UserIcon className="size-4" />
        Add contact
      </button>
      <button
        type="button"
        onClick={() => onSelectType('company')}
        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
      >
        <BuildingIcon className="size-4" />
        Add company
      </button>
    </>
  );
};
