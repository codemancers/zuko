'use client';

import { useState, useCallback, useMemo, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserIcon, BuildingOfficeIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import {
  Button,
  ContextChip,
  EntityItem,
  usePromptInputReferencedSources,
} from '@zuko/ui-kit';
import { type Contact } from '@/lib/api/contacts';
import { type Company } from '@/lib/api/companies';
import { type Deal } from '@/lib/api/deals';
import { getContacts, getCompanies, getDeals } from '@/server/query-options';
import { CHAT_ENTITY_TYPE_LABEL } from '@/lib/constants/chat-context.constants';

// ============================================================================
// Types
// ============================================================================

export type ChatEntityType = 'contact' | 'company' | 'deal';

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

function companyToEntityItem(company: Company): EntityItem {
  const contactCount = company._count?.contacts || 0;
  const description =
    company.website ||
    `${contactCount} contact${contactCount !== 1 ? 's' : ''}`;

  return {
    id: `company-${company.id}`,
    label: company.companyName,
    description,
    icon: <BuildingOfficeIcon className="size-4" />,
    metadata: {
      type: 'company',
      entityId: company.id,
      website: company.website,
      linkedinUrl: company.linkedinUrl,
      summary: company.summary,
    },
  };
}

function dealToEntityItem(deal: Deal): EntityItem {
  const description =
    deal.stage ||
    (deal.value != null
      ? `${deal.currency || 'USD'} ${deal.value.toLocaleString()}`
      : '');

  return {
    id: `deal-${deal.id}`,
    label: deal.title,
    description,
    icon: <BriefcaseIcon className="size-4" />,
    metadata: {
      type: 'deal',
      entityId: deal.id,
      stage: deal.stage,
      value: deal.value,
      currency: deal.currency,
      summary: deal.summary,
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
  const [dialogType, setDialogType] = useState<
    'contact' | 'company' | 'deal' | null
  >(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Use PromptInput's referenced sources hook - must be inside PromptInput context
  const referencedSources = usePromptInputReferencedSources();
  const { sources, add, remove } = referencedSources;

  // Fetch contacts and companies
  const { data: contactsData, isLoading: contactsLoading } = useQuery(
    getContacts({ limit: 100 }),
  );
  const { data: companiesData, isLoading: companiesLoading } = useQuery(
    getCompanies({ limit: 100 }),
  );
  const { data: dealsData, isLoading: dealsLoading } = useQuery(
    getDeals({ limit: 100 }),
  );

  // Convert to generic EntityItem[]
  const contactItems = useMemo(
    () => contactsData?.contacts.map(contactToEntityItem) || [],
    [contactsData],
  );

  const companyItems = useMemo(
    () => companiesData?.companies.map(companyToEntityItem) || [],
    [companiesData],
  );

  const dealItems = useMemo(
    () => dealsData?.deals.map(dealToEntityItem) || [],
    [dealsData],
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
  const handleOpenDialog = useCallback(
    (type: 'contact' | 'company' | 'deal') => {
      setDialogType(type);
      setSelectedIds([]);
      setDialogOpen(true);
    },
    [],
  );

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
        : dialogType === 'deal'
          ? dealItems
          : [];

  const isDialogLoading =
    dialogType === 'contact'
      ? contactsLoading
      : dialogType === 'company'
        ? companiesLoading
        : dealsLoading;

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

const CONTEXT_TYPE_ICON_MAP: Record<ChatEntityType, ReactElement> = {
  contact: <UserIcon className="size-3.5" />,
  company: <BuildingOfficeIcon className="size-3.5" />,
  deal: <BriefcaseIcon className="size-3.5" />,
};

const CONTEXT_TYPE_COLOR_MAP: Record<
  ChatEntityType,
  'blue' | 'purple' | 'green'
> = {
  contact: 'blue',
  company: 'purple',
  deal: 'green',
};

export const ChatContextDisplay = () => {
  const { sources, remove } = usePromptInputReferencedSources();

  if (sources.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => {
        const type = (source as any).metadata?.type as ChatEntityType;
        const color = CONTEXT_TYPE_COLOR_MAP[type] ?? CONTEXT_TYPE_COLOR_MAP.contact;
        const icon = CONTEXT_TYPE_ICON_MAP[type] ?? CONTEXT_TYPE_ICON_MAP.contact;
        const rawLabel = (source as any).title ?? '';
        const label =
          typeof rawLabel === 'string' &&
          rawLabel &&
          !rawLabel.includes('undefined')
            ? rawLabel
            : CHAT_ENTITY_TYPE_LABEL[type] ?? CHAT_ENTITY_TYPE_LABEL.contact;

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
  onSelectType: (type: 'contact' | 'company' | 'deal') => void;
}

export const EntitySelectorTrigger = ({
  onSelectType,
}: EntitySelectorTriggerProps) => {
  return (
    <>
      <Button
        plain
        onClick={() => onSelectType('contact')}
        className="w-full justify-start gap-2 px-3 py-2 text-sm font-normal"
      >
        <UserIcon className="size-4" />
        Add contact
      </Button>
      <Button
        plain
        onClick={() => onSelectType('company')}
        className="w-full justify-start gap-2 px-3 py-2 text-sm font-normal"
      >
        <BuildingOfficeIcon className="size-4" />
        Add company
      </Button>
      <Button
        plain
        onClick={() => onSelectType('deal')}
        className="w-full justify-start gap-2 px-3 py-2 text-sm font-normal"
      >
        <BriefcaseIcon className="size-4" />
        Add deal
      </Button>
    </>
  );
};
