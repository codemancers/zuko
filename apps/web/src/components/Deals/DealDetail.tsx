'use client';

import { useState } from 'react';
import { useAutosaveField } from '@/hooks/useAutosaveField';
import {
  BriefcaseIcon,
  PencilIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Divider,
  Button,
  Input,
  Subheading,
  Switch,
  Text,
} from '@zuko/ui-kit';
import Editor, { ensureOutputData } from '@/components/Common/Editor/Editor';
import type { OutputData } from '@editorjs/editorjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeal } from '@/server/query-options';
import type { UpdateDealDto } from '@/lib/api/deals';
import { dealsApi } from '@/lib/api/deals';
import { toast } from 'sonner';
import { metadataApi } from '@/lib/api/metadata';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';
import AddCompanyToDealDialog from './AddCompanyToDealDialog';
import AddContactToDealDialog from './AddContactToDealDialog';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  BackLink,
  DetailHeader,
  EntityProperties,
  LoadingState,
} from '@/components/shared';
import {
  InlineSaveCancel,
  InlineEditRemove,
} from '@/components/shared/InlineEditActions';
import { formatCurrency, getStageColor, formatStage } from '@/lib/format-utils';

interface DealDetailProps {
  dealId: number;
  currentUserId: number | null;
}

export default function DealDetail({ dealId, currentUserId }: DealDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: deal, isLoading } = useQuery(getDeal(dealId));
  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: metadataApi.getCurrencies,
  });
  const { data: priorities = [] } = useQuery({
    queryKey: ['priorities'],
    queryFn: metadataApi.getDealPriorities,
  });
  const { data: stages = [] } = useQuery({
    queryKey: ['stages'],
    queryFn: metadataApi.getDealStages,
  });

  // State for inline editing company associations
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [editedCompanyIsPrimary, setEditedCompanyIsPrimary] = useState(false);

  // State for inline editing contact associations
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [editedRole, setEditedRole] = useState('');
  const [editedContactIsPrimary, setEditedContactIsPrimary] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (updated: UpdateDealDto) =>
      dealsApi.updateDeal(dealId, updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['timeline', 'deal', dealId] });
    },
    onError: (error) => {
      toast.error('Failed to save changes');
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
    },
  });

  const titleField = useAutosaveField(deal?.title, {
    fieldName: 'deal title',
    onSave: (val) => updateMutation.mutateAsync({ title: val }),
  });

  const summaryField = useAutosaveField<OutputData>(
    ensureOutputData(deal?.summary),
    {
      fieldName: 'summary',
      onSave: (val) => updateMutation.mutateAsync({ summary: val }),
    },
  );

  // Confirm dialog state
  const [showHideDialog, setShowHideDialog] = useState(false);
  const [companyToRemove, setCompanyToRemove] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [contactToRemove, setContactToRemove] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const hideMutation = useMutation({
    mutationFn: () => dealsApi.hideDeal(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      router.push('/deals');
    },
  });

  const removeCompanyMutation = useMutation({
    mutationFn: (companyId: number) =>
      dealsApi.removeCompany(dealId, companyId),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['deal', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['deals'] });
      await queryClient.invalidateQueries({
        queryKey: ['timeline', 'deal', dealId],
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: ({
      companyId,
      isPrimary,
    }: {
      companyId: number;
      isPrimary: boolean;
    }) => dealsApi.updateCompany(dealId, companyId, { isPrimary }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['deal', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['deals'] });
      setEditingCompanyId(null);
    },
  });

  const removeContactMutation = useMutation({
    mutationFn: (contactId: number) =>
      dealsApi.removeContact(dealId, contactId),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['deal', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['deals'] });
      await queryClient.invalidateQueries({
        queryKey: ['timeline', 'deal', dealId],
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: ({
      contactId,
      role,
      isPrimary,
    }: {
      contactId: number;
      role?: string;
      isPrimary?: boolean;
    }) => dealsApi.updateContact(dealId, contactId, { role, isPrimary }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['deal', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['deals'] });
      setEditingContactId(null);
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading deal..." />;
  }

  if (!deal) {
    return <LoadingState message="Deal not found" />;
  }

  const primaryOwner = deal.owners.find((o) => o.isPrimary);
  const primaryOwnerName = primaryOwner?.user.name || 'Unassigned';

  const handleEdit = () => {
    router.push(`/deals/${dealId}/edit`);
  };

  const handleHide = () => {
    setShowHideDialog(true);
  };

  const handleRemoveCompany = (companyId: number, companyName: string) => {
    setCompanyToRemove({ id: companyId, name: companyName });
  };

  const handleEditCompany = (companyId: number, currentIsPrimary: boolean) => {
    setEditingCompanyId(companyId);
    setEditedCompanyIsPrimary(currentIsPrimary);
  };

  const handleSaveCompany = (companyId: number) => {
    updateCompanyMutation.mutate({
      companyId,
      isPrimary: editedCompanyIsPrimary,
    });
  };

  const handleCancelEdit = () => {
    setEditingCompanyId(null);
    setEditedCompanyIsPrimary(false);
  };

  const handleRemoveContact = (contactId: number, contactName: string) => {
    setContactToRemove({ id: contactId, name: contactName });
  };

  const handleEditContact = (
    contactId: number,
    currentRole: string | undefined,
    currentIsPrimary: boolean,
  ) => {
    setEditingContactId(contactId);
    setEditedRole(currentRole || '');
    setEditedContactIsPrimary(currentIsPrimary);
  };

  const handleSaveContact = (contactId: number) => {
    updateContactMutation.mutate({
      contactId,
      role: editedRole || undefined,
      isPrimary: editedContactIsPrimary,
    });
  };

  const handleCancelContactEdit = () => {
    setEditingContactId(null);
    setEditedRole('');
    setEditedContactIsPrimary(false);
  };

  const getPriorityLabel = (priority?: number) => {
    const match = priorities.find((p) => p.value === priority);
    return match?.label ?? priorities.find((p) => p.value === 2)?.label ?? '—';
  };

  return (
    <>
      <BackLink href="/deals">Deals</BackLink>

      <div className="mt-4 flex items-start justify-between">
        <DetailHeader
          icon={BriefcaseIcon}
          title={titleField.value}
          onTitleBlur={(val) => titleField.setValue(val)}
          isSaving={titleField.isSaving || updateMutation.isPending}
          subtitle={
            <>
              <Badge color={getStageColor(deal.stage)} className="text-xs">
                {formatStage(deal.stage)}
              </Badge>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {formatCurrency(deal.value, deal.currency)}
              </span>
            </>
          }
        />
        <div className="flex gap-3">
          <Button onClick={handleEdit}>
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
          <Button plain onClick={handleHide} disabled={hideMutation.isPending}>
            <EyeSlashIcon className="h-4 w-4" />
            {hideMutation.isPending ? 'Hiding...' : 'Hide'}
          </Button>
        </div>
      </div>

      <Divider className="mt-6" />

      <ConfirmDialog
        open={showHideDialog}
        onClose={() => setShowHideDialog(false)}
        onConfirm={() => hideMutation.mutate()}
        title="Hide Deal"
        description="Are you sure you want to hide this deal?"
        confirmText="Hide"
        isLoading={hideMutation.isPending}
      />
      <ConfirmDialog
        open={!!companyToRemove}
        onClose={() => setCompanyToRemove(null)}
        onConfirm={() =>
          companyToRemove && removeCompanyMutation.mutate(companyToRemove.id)
        }
        title="Remove Company"
        description={
          companyToRemove
            ? `Are you sure you want to remove ${companyToRemove.name} from this deal?`
            : ''
        }
        confirmText="Remove"
        confirmColor="red"
        isLoading={removeCompanyMutation.isPending}
      />
      <ConfirmDialog
        open={!!contactToRemove}
        onClose={() => setContactToRemove(null)}
        onConfirm={() =>
          contactToRemove && removeContactMutation.mutate(contactToRemove.id)
        }
        title="Remove Contact"
        description={
          contactToRemove
            ? `Are you sure you want to remove ${contactToRemove.name} from this deal?`
            : ''
        }
        confirmText="Remove"
        confirmColor="red"
        isLoading={removeContactMutation.isPending}
      />

      <EntityProperties
        properties={[
          {
            label: 'Owners',
            value: primaryOwnerName,
            renderType: 'user',
            isPrimary: true,
          },
          {
            label: 'Stage',
            value: formatStage(deal.stage),
            renderType: 'badge',
            fieldType: 'combobox',
            options: {
              badgeColor: getStageColor(deal.stage),
              comboboxOptions: stages.map((s) => ({
                value: s.value,
                label: s.label,
              })),
            },
            isPrimary: true,
            onSave: (val: string) => updateMutation.mutateAsync({ stage: val }),
          },
          {
            label: 'Value',
            value: deal.value,
            renderType: 'currency',
            fieldType: 'currency',
            options: {
              currency: deal.currency,
              currencyOptions: currencies.map((c) => ({
                code: c.code,
                symbol: c.symbol,
                name: c.name,
              })),
            },
            isPrimary: true,
            onSave: (val: { value: number; currency: string }) =>
              updateMutation.mutateAsync({
                value: val.value,
                currency: val.currency,
              }),
          },
          {
            label: 'Priority',
            value: getPriorityLabel(deal.priority),
            fieldType: 'combobox',
            options: {
              comboboxOptions: priorities.map((p) => ({
                value: p.value,
                label: p.label,
              })),
            },
            isPrimary: true,
            onSave: (val: number) =>
              updateMutation.mutateAsync({ priority: val }),
          },
          {
            label: 'Win Probability',
            value: deal.probability != null ? `${deal.probability}%` : null,
            fieldType: 'number',
            placeholder: '0-100',
            options: { min: 0, max: 100 },
            onSave: (val) => updateMutation.mutateAsync({ probability: val }),
          },
          {
            label: 'Expected Close',
            value: deal.expectedCloseDate,
            renderType: 'date',
            fieldType: 'date',
            isPrimary: true,
            onSave: (val) =>
              updateMutation.mutateAsync({ expectedCloseDate: val }),
          },
          {
            label: 'Actual Close',
            value: deal.actualCloseDate,
            renderType: 'date',
            fieldType: 'date',
            onSave: (val) =>
              updateMutation.mutateAsync({ actualCloseDate: val }),
          },
          {
            label: 'Source',
            value: deal.source,
            fieldType: 'text',
            placeholder: 'e.g., Referral, Inbound, Outbound',
            onSave: (val) => updateMutation.mutateAsync({ source: val }),
          },
        ]}
      />

      {/* Summary */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <Subheading>Summary</Subheading>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 min-h-32 bg-white dark:bg-zinc-900 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
          <Editor
            key={`deal-summary-${dealId}`}
            holder="deal-summary-editor"
            data={summaryField.value}
            onChange={(val) => summaryField.setValue(val)}
            placeholder="No summary yet. Add one..."
          />
        </div>
      </div>

      {/* Associated Companies */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <Subheading>Associated Companies</Subheading>
          <AddCompanyToDealDialog
            dealId={dealId}
            existingCompanyIds={deal.companies?.map((da) => da.companyId) || []}
          />
        </div>
        {deal.companies && deal.companies.length > 0 ? (
          <div className="mt-4 space-y-3">
            {deal.companies.map((da) => (
              <div key={da.id} className="flex items-center gap-3">
                <div className="text-sm min-w-50">
                  <Link
                    href={`/companies/${da.company.id}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {da.company.companyName}
                  </Link>
                </div>

                {editingCompanyId === da.companyId ? (
                  // Edit mode
                  <>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={editedCompanyIsPrimary}
                        onChange={setEditedCompanyIsPrimary}
                        color="blue"
                      />
                      <Text className="text-xs">Primary</Text>
                    </div>
                    <InlineSaveCancel
                      onSave={() => handleSaveCompany(da.companyId)}
                      onCancel={handleCancelEdit}
                      disabled={updateCompanyMutation.isPending}
                    />
                  </>
                ) : (
                  // View mode
                  <>
                    {da.isPrimary && (
                      <Badge color="lime" className="text-xs">
                        Primary
                      </Badge>
                    )}
                    <InlineEditRemove
                      onEdit={() =>
                        handleEditCompany(da.companyId, da.isPrimary)
                      }
                      onRemove={() =>
                        handleRemoveCompany(
                          da.companyId,
                          da.company.companyName,
                        )
                      }
                      disabled={
                        updateCompanyMutation.isPending ||
                        removeCompanyMutation.isPending
                      }
                      removeTitle="Remove company"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-center py-8 text-sm text-zinc-600 dark:text-zinc-400">
            No companies associated yet
          </div>
        )}
      </div>

      {/* Associated Contacts */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <Subheading>Associated Contacts</Subheading>
          <AddContactToDealDialog
            dealId={dealId}
            existingContactIds={deal.contacts?.map((dc) => dc.contactId) || []}
          />
        </div>
        {deal.contacts && deal.contacts.length > 0 ? (
          <div className="mt-4 space-y-3">
            {deal.contacts.map((dc) => (
              <div key={dc.id} className="flex items-center gap-3">
                <div className="text-sm min-w-37.5">
                  <Link
                    href={`/contacts/${dc.contact.id}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {dc.contact.name}
                  </Link>
                </div>

                {editingContactId === dc.contactId ? (
                  // Edit mode
                  <>
                    <Input
                      type="text"
                      value={editedRole}
                      onChange={(e) => setEditedRole(e.target.value)}
                      placeholder="Role"
                      className="h-auto py-1 text-sm"
                    />
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={editedContactIsPrimary}
                        onChange={setEditedContactIsPrimary}
                        color="blue"
                      />
                      <Text className="text-xs">Primary</Text>
                    </div>
                    <InlineSaveCancel
                      onSave={() => handleSaveContact(dc.contactId)}
                      onCancel={handleCancelContactEdit}
                      disabled={updateContactMutation.isPending}
                    />
                  </>
                ) : (
                  // View mode
                  <>
                    {dc.role && (
                      <Badge color="zinc" className="text-xs">
                        {dc.role}
                      </Badge>
                    )}
                    {dc.isPrimary && (
                      <Badge color="lime" className="text-xs">
                        Primary
                      </Badge>
                    )}
                    <InlineEditRemove
                      onEdit={() =>
                        handleEditContact(dc.contactId, dc.role, dc.isPrimary)
                      }
                      onRemove={() =>
                        handleRemoveContact(dc.contactId, dc.contact.name)
                      }
                      disabled={
                        updateContactMutation.isPending ||
                        removeContactMutation.isPending
                      }
                      removeTitle="Remove contact"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-center py-8 text-sm text-zinc-600 dark:text-zinc-400">
            No contacts associated yet
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <ActivityTimeline
        entityType="deal"
        entityId={dealId}
        currentUserId={currentUserId ?? undefined}
      />
    </>
  );
}
