'use client';

import { useState } from 'react';
import {
  BriefcaseIcon,
  PencilIcon,
  EyeSlashIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { Badge, Divider, Heading, Button } from '@zuko/ui-kit';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeal } from '@/server/query-options';
import { dealsApi } from '@/lib/api/deals';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';
import AddCompanyToDealDialog from './AddCompanyToDealDialog';
import AddContactToDealDialog from './AddContactToDealDialog';

interface DealDetailProps {
  dealId: number;
  currentUserId: number | null;
}

export default function DealDetail({ dealId, currentUserId }: DealDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: deal, isLoading } = useQuery(getDeal(dealId));

  // State for inline editing company associations
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [editedCompanyIsPrimary, setEditedCompanyIsPrimary] = useState(false);

  // State for inline editing contact associations
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [editedRole, setEditedRole] = useState('');
  const [editedContactIsPrimary, setEditedContactIsPrimary] = useState(false);

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
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading deal...
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Deal not found
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    router.push(`/deals/${dealId}/edit`);
  };

  const handleHide = () => {
    if (confirm('Are you sure you want to hide this deal?')) {
      hideMutation.mutate();
    }
  };

  const handleRemoveCompany = (companyId: number, companyName: string) => {
    if (
      confirm(`Are you sure you want to remove ${companyName} from this deal?`)
    ) {
      removeCompanyMutation.mutate(companyId);
    }
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
    if (
      confirm(`Are you sure you want to remove ${contactName} from this deal?`)
    ) {
      removeContactMutation.mutate(contactId);
    }
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

  const formatCurrency = (value?: number, currency?: string) => {
    if (value === undefined || value === null) return '-';
    const curr = currency || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStageColor = (
    stage: string,
  ): 'zinc' | 'blue' | 'yellow' | 'green' | 'red' => {
    const stageColors: Record<
      string,
      'zinc' | 'blue' | 'yellow' | 'green' | 'red'
    > = {
      prospecting: 'zinc',
      qualification: 'blue',
      proposal: 'yellow',
      negotiation: 'yellow',
      closed_won: 'green',
      closed_lost: 'red',
    };
    return stageColors[stage] || 'zinc';
  };

  const formatStage = (stage: string) => {
    return stage
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getPriorityLabel = (priority?: number) => {
    const labels: Record<number, string> = {
      0: 'P0 - Critical',
      1: 'P1 - High',
      2: 'P2 - Medium',
      3: 'P3 - Low',
      4: 'P4 - Backlog',
    };
    return labels[priority ?? 2] || 'P2 - Medium';
  };

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <BriefcaseIcon className="h-8 w-8 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div>
            <Heading>{deal.title}</Heading>
            <div className="mt-1 flex items-center gap-2">
              <Badge color={getStageColor(deal.stage)} className="text-xs">
                {formatStage(deal.stage)}
              </Badge>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {formatCurrency(deal.value, deal.currency)}
              </span>
            </div>
          </div>
        </div>
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

      {/* Deal Information */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Deal Information
        </h2>
        <dl className="mt-4 space-y-4">
          <div className="grid grid-cols-3">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Value
            </dt>
            <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
              {formatCurrency(deal.value, deal.currency)}
            </dd>
          </div>
          <div className="grid grid-cols-3">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Stage
            </dt>
            <dd className="col-span-2 text-sm">
              <Badge color={getStageColor(deal.stage)} className="text-xs">
                {formatStage(deal.stage)}
              </Badge>
            </dd>
          </div>
          {deal.probability !== undefined && (
            <div className="grid grid-cols-3">
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Win Probability
              </dt>
              <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
                {deal.probability}%
              </dd>
            </div>
          )}
          {deal.expectedCloseDate && (
            <div className="grid grid-cols-3">
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Expected Close Date
              </dt>
              <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
                {dayjs(deal.expectedCloseDate).format('MMMM D, YYYY')}
              </dd>
            </div>
          )}
          {deal.actualCloseDate && (
            <div className="grid grid-cols-3">
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Actual Close Date
              </dt>
              <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
                {dayjs(deal.actualCloseDate).format('MMMM D, YYYY')}
              </dd>
            </div>
          )}
          {deal.source && (
            <div className="grid grid-cols-3">
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Source
              </dt>
              <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
                {deal.source}
              </dd>
            </div>
          )}
          <div className="grid grid-cols-3">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Priority
            </dt>
            <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
              {getPriorityLabel(deal.priority)}
            </dd>
          </div>
          {deal.lostReason && (
            <div className="grid grid-cols-3">
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Lost Reason
              </dt>
              <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
                {deal.lostReason}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Ownership */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Owners
        </h2>
        <div className="mt-4 space-y-2">
          {deal.owners.map((owner) => (
            <div key={owner.id} className="flex items-center gap-3">
              <div className="text-sm text-zinc-950 dark:text-white">
                {owner.user.name}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {owner.user.email}
              </div>
              {owner.isPrimary && (
                <Badge color="lime" className="text-xs">
                  Primary
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      {deal.summary && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
            Summary
          </h2>
          <div className="mt-4 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm text-zinc-950 dark:bg-zinc-900 dark:text-white">
            {deal.summary}
          </div>
        </div>
      )}

      {/* Associated Companies */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
            Associated Companies
          </h2>
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
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={editedCompanyIsPrimary}
                        onChange={(e) =>
                          setEditedCompanyIsPrimary(e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700"
                      />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        Primary
                      </span>
                    </label>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => handleSaveCompany(da.companyId)}
                        disabled={updateCompanyMutation.isPending}
                        className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                        title="Save changes"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={updateCompanyMutation.isPending}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        title="Cancel"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  // View mode
                  <>
                    {da.isPrimary && (
                      <Badge color="lime" className="text-xs">
                        Primary
                      </Badge>
                    )}
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() =>
                          handleEditCompany(da.companyId, da.isPrimary)
                        }
                        disabled={
                          updateCompanyMutation.isPending ||
                          removeCompanyMutation.isPending
                        }
                        className="text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Edit association"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleRemoveCompany(
                            da.companyId,
                            da.company.companyName,
                          )
                        }
                        disabled={
                          updateCompanyMutation.isPending ||
                          removeCompanyMutation.isPending
                        }
                        className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Remove company"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
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
          <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
            Associated Contacts
          </h2>
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
                    <input
                      type="text"
                      value={editedRole}
                      onChange={(e) => setEditedRole(e.target.value)}
                      placeholder="Role"
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    />
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={editedContactIsPrimary}
                        onChange={(e) =>
                          setEditedContactIsPrimary(e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700"
                      />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        Primary
                      </span>
                    </label>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => handleSaveContact(dc.contactId)}
                        disabled={updateContactMutation.isPending}
                        className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                        title="Save changes"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleCancelContactEdit}
                        disabled={updateContactMutation.isPending}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        title="Cancel"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
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
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() =>
                          handleEditContact(dc.contactId, dc.role, dc.isPrimary)
                        }
                        disabled={
                          updateContactMutation.isPending ||
                          removeContactMutation.isPending
                        }
                        className="text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Edit association"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleRemoveContact(dc.contactId, dc.contact.name)
                        }
                        disabled={
                          updateContactMutation.isPending ||
                          removeContactMutation.isPending
                        }
                        className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Remove contact"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
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

      {/* Metadata */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Details
        </h2>
        <dl className="mt-4 space-y-4">
          <div className="grid grid-cols-3">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Created
            </dt>
            <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
              {dayjs(deal.createdAt).format('MMMM D, YYYY [at] h:mm A')}
            </dd>
          </div>
          <div className="grid grid-cols-3">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Last Updated
            </dt>
            <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
              {dayjs(deal.updatedAt).format('MMMM D, YYYY [at] h:mm A')}
            </dd>
          </div>
        </dl>
      </div>

      {/* Activity Timeline */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Activity
        </h2>
        <div className="mt-4">
          <ActivityTimeline
            entityType="deal"
            entityId={dealId}
            currentUserId={currentUserId ?? undefined}
          />
        </div>
      </div>
    </>
  );
}
