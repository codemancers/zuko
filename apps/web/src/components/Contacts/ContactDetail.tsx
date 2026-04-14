'use client';

import { useState } from 'react';
import { useAutosaveField } from '@/hooks/useAutosaveField';
import {
  UserIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Divider,
  Subheading,
  Textarea,
} from '@zuko/ui-kit';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContact, getDealsByContact } from '@/server/query-options';
import { contactsApi } from '@/lib/api/contacts';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';

import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { BackLink, DetailHeader } from '@/components/shared';
import { LoadingState } from '@/components/shared';
import { formatCurrency, getStageColor, formatStage } from '@/lib/format-utils';

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
  const updateMutation = useMutation({
    mutationFn: (updated: { name?: string; notes?: string }) =>
      contactsApi.updateContact(contactId, updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const nameField = useAutosaveField(contact?.name, {
    fieldName: 'contact name',
    onSave: (val) => updateMutation.mutateAsync({ name: val }),
  });

  const notesField = useAutosaveField(contact?.notes, {
    fieldName: 'notes',
    onSave: (val) => updateMutation.mutateAsync({ notes: val }),
  });

  const [showHideDialog, setShowHideDialog] = useState(false);

  const hideMutation = useMutation({
    mutationFn: () => contactsApi.hideContact(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      router.push('/contacts');
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading contact..." />;
  }

  if (!contact) {
    return <LoadingState message="Contact not found" />;
  }


  const handleHide = () => {
    setShowHideDialog(true);
  };

  return (
    <>
      <BackLink href="/contacts">Contacts</BackLink>

      <div className="mt-4 flex items-start justify-between">
        <DetailHeader
          icon={UserIcon}
          title={nameField.value}
          onTitleBlur={(val) => nameField.setValue(val)}
          isSaving={nameField.isSaving}
          createdAt={contact.createdAt}
        />
        <div className="flex gap-3">
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
        <Subheading>Owners</Subheading>
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
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <Subheading>Notes</Subheading>
          {notesField.isSaving && (
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 animate-pulse">
              Syncing...
            </span>
          )}
        </div>
        <Textarea
          value={notesField.value}
          onChange={(e) => notesField.setValue(e.target.value)}
          placeholder="No notes yet. Add one..."
          className="h-32"
        />
      </div>

      {/* Associated Deals */}
      {dealsData && dealsData.deals && dealsData.deals.length > 0 && (
        <div className="mt-8">
          <Subheading>Associated Deals</Subheading>
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

      {/* Activity Timeline */}
      <ActivityTimeline
        entityType="contact"
        entityId={contactId}
        currentUserId={currentUserId ?? undefined}
      />
    </>
  );
}
