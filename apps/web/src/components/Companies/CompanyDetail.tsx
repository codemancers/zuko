'use client';

import { useState } from 'react';
import {
  BuildingOfficeIcon,
  PencilIcon,
  EyeSlashIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { Badge, Divider, Heading, Button } from '@zuko/ui-kit';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCompany, getDealsByCompany } from '@/server/query-options';
import { companiesApi } from '@/lib/api/companies';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';
import AddContactDialog from './AddContactDialog';

interface CompanyDetailProps {
  companyId: number;
  currentUserId: number | null;
}

export default function CompanyDetail({
  companyId,
  currentUserId,
}: CompanyDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: company, isLoading } = useQuery(getCompany(companyId));
  const { data: dealsData } = useQuery(getDealsByCompany(companyId));

  // State for inline editing contact associations
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [editedRole, setEditedRole] = useState('');
  const [editedIsPrimary, setEditedIsPrimary] = useState(false);

  const hideMutation = useMutation({
    mutationFn: () => companiesApi.hideCompany(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      router.push('/companies');
    },
  });

  const removeContactMutation = useMutation({
    mutationFn: (contactId: number) =>
      companiesApi.removeContact(companyId, contactId),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['company', companyId] });
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
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
    }) => companiesApi.updateContact(companyId, contactId, { role, isPrimary }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['company', companyId] });
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      setEditingContactId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading company...
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Company not found
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    router.push(`/companies/${companyId}/edit`);
  };

  const handleHide = () => {
    if (confirm('Are you sure you want to hide this company?')) {
      hideMutation.mutate();
    }
  };

  const handleRemoveContact = (contactId: number, contactName: string) => {
    if (
      confirm(
        `Are you sure you want to remove ${contactName} from this company?`
      )
    ) {
      removeContactMutation.mutate(contactId);
    }
  };

  const handleEditContact = (
    contactId: number,
    currentRole: string | undefined,
    currentIsPrimary: boolean
  ) => {
    setEditingContactId(contactId);
    setEditedRole(currentRole || '');
    setEditedIsPrimary(currentIsPrimary);
  };

  const handleSaveContact = (contactId: number) => {
    updateContactMutation.mutate({
      contactId,
      role: editedRole || undefined,
      isPrimary: editedIsPrimary,
    });
  };

  const handleCancelEdit = () => {
    setEditingContactId(null);
    setEditedRole('');
    setEditedIsPrimary(false);
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
    stage: string
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

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <BuildingOfficeIcon className="h-8 w-8 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div>
            <Heading>{company.companyName}</Heading>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Created {dayjs(company.createdAt).format('MMMM D, YYYY')}
            </p>
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

      {/* Company Information */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Company Information
        </h2>
        <dl className="mt-4 space-y-4">
          {company.website && (
            <div className="grid grid-cols-3">
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Website
              </dt>
              <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {company.website}
                </a>
              </dd>
            </div>
          )}
          {company.linkedinUrl && (
            <div className="grid grid-cols-3">
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                LinkedIn
              </dt>
              <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
                <a
                  href={company.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {company.linkedinUrl}
                </a>
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
          {company.owners.map((owner) => (
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
      {company.summary && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
            Summary
          </h2>
          <div className="mt-4 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm text-zinc-950 dark:bg-zinc-900 dark:text-white">
            {company.summary}
          </div>
        </div>
      )}

      {/* Associated Contacts */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
            Associated Contacts
          </h2>
          <AddContactDialog
            companyId={companyId}
            existingContactIds={
              company.contacts?.map((ac) => ac.contactId) || []
            }
          />
        </div>
        {company.contacts && company.contacts.length > 0 ? (
          <div className="mt-4 space-y-3">
            {company.contacts.map((ac) => (
              <div key={ac.id} className="flex items-center gap-3">
                <div className="text-sm min-w-[150px]">
                  <Link
                    href={`/contacts/${ac.contactId}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {ac.contact.name}
                  </Link>
                </div>

                {editingContactId === ac.contactId ? (
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
                        checked={editedIsPrimary}
                        onChange={(e) => setEditedIsPrimary(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700"
                      />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        Primary
                      </span>
                    </label>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Joined {dayjs(ac.joinedAt).format('MMM D, YYYY')}
                    </div>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => handleSaveContact(ac.contactId)}
                        disabled={updateContactMutation.isPending}
                        className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                        title="Save changes"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
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
                    {ac.role && (
                      <Badge color="zinc" className="text-xs">
                        {ac.role}
                      </Badge>
                    )}
                    {ac.isPrimary && (
                      <Badge color="lime" className="text-xs">
                        Primary
                      </Badge>
                    )}
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Joined {dayjs(ac.joinedAt).format('MMM D, YYYY')}
                    </div>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() =>
                          handleEditContact(ac.contactId, ac.role, ac.isPrimary)
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
                          handleRemoveContact(ac.contactId, ac.contact.name)
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

      {/* Associated Deals */}
      {dealsData && dealsData.deals && dealsData.deals.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
            Associated Deals
          </h2>
          <div className="mt-4 space-y-3">
            {dealsData.deals.map((deal: any) => {
              const dealCompany = deal.companies?.find(
                (da: any) => da.companyId === companyId
              );
              return (
                <div key={deal.id} className="flex items-center gap-3">
                  <div className="text-sm min-w-[200px]">
                    <Link
                      href={`/deals/${deal.id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {deal.title}
                    </Link>
                  </div>
                  {dealCompany?.isPrimary && (
                    <Badge color="lime" className="text-xs">
                      Primary
                    </Badge>
                  )}
                  <Badge color={getStageColor(deal.stage)} className="text-xs">
                    {formatStage(deal.stage)}
                  </Badge>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {formatCurrency(deal.value, deal.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              {dayjs(company.createdAt).format('MMMM D, YYYY [at] h:mm A')}
            </dd>
          </div>
          <div className="grid grid-cols-3">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Last Updated
            </dt>
            <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
              {dayjs(company.updatedAt).format('MMMM D, YYYY [at] h:mm A')}
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
            entityType="company"
            entityId={companyId}
            currentUserId={currentUserId ?? undefined}
          />
        </div>
      </div>
    </>
  );
}
