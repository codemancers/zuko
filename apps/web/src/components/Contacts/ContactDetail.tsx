'use client';

import { useState } from 'react';
import {
  UserIcon,
  PencilIcon,
  EyeSlashIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';
import { Badge, Divider, Heading, Button, Subheading } from '@zuko/ui-kit';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContact, getDealsByContact } from '@/server/query-options';
import { contactsApi } from '@/lib/api/contacts';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';
import { EMPTY_VALUE } from '@/components/Table';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface ContactDetailProps {
  contactId: number;
  currentUserId: number | null;
}

export default function ContactDetail({
  contactId,
  currentUserId,
}: ContactDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: contact, isLoading } = useQuery(getContact(contactId));
  const { data: dealsData } = useQuery(getDealsByContact(contactId));
  const [showHideDialog, setShowHideDialog] = useState(false);

  const hideMutation = useMutation({
    mutationFn: () => contactsApi.hideContact(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      router.push('/contacts');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading contact...
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Contact not found
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    router.push(`/contacts/${contactId}/edit`);
  };

  const handleHide = () => {
    setShowHideDialog(true);
  };

  const formatCurrency = (value?: number, currency?: string) => {
    if (value === undefined || value === null) return EMPTY_VALUE;
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

  return (
    <>
      <Link href="/contacts" className="inline-flex items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
        <ChevronLeftIcon className="size-4" />
        Contacts
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <UserIcon className="h-8 w-8 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div>
            <Heading>{contact.name}</Heading>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Created {dayjs(contact.createdAt).format('MMMM D, YYYY')}
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
        title="Hide Contact"
        description="Are you sure you want to hide this contact?"
        confirmText="Hide"
        isLoading={hideMutation.isPending}
      />

      {/* Contact Information */}
      <div className="mt-8">
        <Subheading>Contact Information</Subheading>
        <dl className="mt-4 space-y-4">
          {contact.email && (
            <div className="grid grid-cols-3">
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Email
              </dt>
              <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
                <a
                  href={`mailto:${contact.email}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {contact.email}
                </a>
              </dd>
            </div>
          )}
          {contact.phone && (
            <div className="grid grid-cols-3">
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Phone
              </dt>
              <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
                <a
                  href={`tel:${contact.phone}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {contact.phone}
                </a>
              </dd>
            </div>
          )}
          {contact.linkedinId && (
            <div className="grid grid-cols-3">
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                LinkedIn
              </dt>
              <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
                {contact.linkedinId}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Ownership */}
      <div className="mt-8">
        <Subheading>
          Owners
        </Subheading>
        <div className="mt-4 space-y-2">
          {contact.owners.map((owner) => (
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

      {/* Notes */}
      {contact.notes && (
        <div className="mt-8">
          <Subheading>
            Notes
          </Subheading>
          <div className="mt-4 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm text-zinc-950 dark:bg-zinc-900 dark:text-white">
            {contact.notes}
          </div>
        </div>
      )}

      {/* Associated Deals */}
      {dealsData && dealsData.deals && dealsData.deals.length > 0 && (
        <div className="mt-8">
          <Subheading>
            Associated Deals
          </Subheading>
          <div className="mt-4 space-y-3">
            {dealsData.deals.map((deal: any) => {
              const dealContact = deal.contacts?.find(
                (dc: any) => dc.contactId === contactId,
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
                  {dealContact?.role && (
                    <Badge color="zinc" className="text-xs">
                      {dealContact.role}
                    </Badge>
                  )}
                  {dealContact?.isPrimary && (
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
        <Subheading>
          Details
        </Subheading>
        <dl className="mt-4 space-y-4">
          <div className="grid grid-cols-3">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Created
            </dt>
            <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
              {dayjs(contact.createdAt).format('MMMM D, YYYY [at] h:mm A')}
            </dd>
          </div>
          <div className="grid grid-cols-3">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Last Updated
            </dt>
            <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
              {dayjs(contact.updatedAt).format('MMMM D, YYYY [at] h:mm A')}
            </dd>
          </div>
        </dl>
      </div>

      {/* Activity Timeline */}
      <div className="mt-8">
        <Subheading>
          Activity
        </Subheading>
        <div className="mt-4">
          <ActivityTimeline
            entityType="contact"
            entityId={contactId}
            currentUserId={currentUserId ?? undefined}
          />
        </div>
      </div>
    </>
  );
}
