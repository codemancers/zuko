'use client';

import { useState } from 'react';
import {
  BuildingOfficeIcon,
  PencilIcon,
  EyeSlashIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Divider,
  Heading,
  Button,
  Input,
  Subheading,
} from '@zuko/ui-kit';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCompany, getDealsByCompany } from '@/server/query-options';
import { companiesApi } from '@/lib/api/companies';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';
import AddContactDialog from './AddContactDialog';

import ConfirmDialog from '@/components/shared/ConfirmDialog';
import {
  InlineSaveCancel,
  InlineEditRemove,
} from '@/components/shared/InlineEditActions';
import { LoadingState } from '@/components/shared';
import { formatCurrency, getStageColor, formatStage } from '@/lib/format-utils';

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
  const [showHideDialog, setShowHideDialog] = useState(false);
  const [contactToRemove, setContactToRemove] = useState<{
    id: number;
    name: string;
  } | null>(null);

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
      await queryClient.invalidateQueries({
        queryKey: ['timeline', 'company', companyId],
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
    }) => companiesApi.updateContact(companyId, contactId, { role, isPrimary }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['company', companyId] });
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      await queryClient.invalidateQueries({
        queryKey: ['timeline', 'company', companyId],
      });
      setEditingContactId(null);
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading company..." />;
  }

  if (!company) {
    return <LoadingState message="Company not found" />;
  }

  const handleEdit = () => {
    router.push(`/companies/${companyId}/edit`);
  };

  const handleHide = () => {
    setShowHideDialog(true);
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

  return (
    <>
      <Link
        href="/companies"
        className="inline-flex items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400"
      >
        <ChevronLeftIcon className="size-4" />
        Companies
      </Link>

      <div className="mt-4 flex items-start justify-between">
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

      <ConfirmDialog
        open={showHideDialog}
        onClose={() => setShowHideDialog(false)}
        onConfirm={() => hideMutation.mutate()}
        title="Hide Company"
        description="Are you sure you want to hide this company?"
        confirmText="Hide"
        isLoading={hideMutation.isPending}
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
            ? `Are you sure you want to remove ${contactToRemove.name} from this company?`
            : ''
        }
        confirmText="Remove"
        confirmColor="red"
        isLoading={removeContactMutation.isPending}
      />

      {/* Company Information */}
      <div className="mt-8">
        <Subheading>Company Information</Subheading>
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
        <Subheading>Owners</Subheading>
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
          <Subheading>Summary</Subheading>
          <div className="mt-4 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm text-zinc-950 dark:bg-zinc-900 dark:text-white">
            {company.summary}
          </div>
        </div>
      )}

      {/* Associated Contacts */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <Subheading>Associated Contacts</Subheading>
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
                    <Input
                      type="text"
                      value={editedRole}
                      onChange={(e) => setEditedRole(e.target.value)}
                      placeholder="Role"
                      className="h-auto py-1 text-sm"
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
                    <InlineSaveCancel
                      onSave={() => handleSaveContact(ac.contactId)}
                      onCancel={handleCancelEdit}
                      disabled={updateContactMutation.isPending}
                    />
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
                    <InlineEditRemove
                      onEdit={() =>
                        handleEditContact(ac.contactId, ac.role, ac.isPrimary)
                      }
                      onRemove={() =>
                        handleRemoveContact(ac.contactId, ac.contact.name)
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

      {/* Associated Deals */}
      {dealsData && dealsData.deals && dealsData.deals.length > 0 && (
        <div className="mt-8">
          <Subheading>Associated Deals</Subheading>
          <div className="mt-4 space-y-3">
            {dealsData.deals.map((deal: any) => {
              const dealCompany = deal.companies?.find(
                (da: any) => da.companyId === companyId,
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
        <Subheading>Details</Subheading>
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
        <Subheading>Activity</Subheading>
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
