'use client';

import { useState } from 'react';
import { useAutosaveField } from '@/hooks/useAutosaveField';
import {
  UserIcon,
  PencilIcon,
  EyeSlashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Divider,
  Sheet,
  SheetHeader,
  SheetTitle,
  Subheading,
} from '@zuko/ui-kit';
import ContactForm from './ContactForm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContact, getDealsByContact } from '@/server/query-options';
import type { UpdateContactDto } from '@/lib/api/contacts';
import { contactsApi } from '@/lib/api/contacts';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';
import Editor, { ensureOutputData } from '@/components/Common/Editor/Editor';
import type { OutputData } from '@editorjs/editorjs';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  BackLink,
  DetailHeader,
  EntityProperties,
  LoadingState,
} from '@/components/shared';
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
    mutationFn: (updated: UpdateContactDto) =>
      contactsApi.updateContact(contactId, updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({
        queryKey: ['timeline', 'contact', contactId],
      });
    },
    onError: () => {
      toast.error('Failed to save changes');
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
    },
  });

  const nameField = useAutosaveField(contact?.name, {
    fieldName: 'contact name',
    onSave: (val) => updateMutation.mutateAsync({ name: val }),
  });

  const notesField = useAutosaveField<OutputData>(
    ensureOutputData(contact?.notes),
    {
      fieldName: 'notes',
      onSave: (val) => updateMutation.mutateAsync({ notes: val }),
    },
  );

  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
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
    return <LoadingState message="Contact not found." />;
  }

  const primaryOwner = contact.owners.find((o) => o.isPrimary);
  const primaryOwnerName = primaryOwner?.user.name || 'Unassigned';

  const handleEdit = () => {
    setIsEditSheetOpen(true);
  };

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
          isSaving={nameField.isSaving || updateMutation.isPending}
          createdAt={contact.createdAt}
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
        title="Hide Contact"
        description="Are you sure you want to hide this contact?"
        confirmText="Hide"
        isLoading={hideMutation.isPending}
      />

      <EntityProperties
        properties={[
          {
            label: 'Owners',
            value: primaryOwnerName,
            renderType: 'user',
          },
          {
            label: 'Email',
            value: contact.email,
            renderType: 'email',
            fieldType: 'text',
            placeholder: 'eg: john@example.com',
            onSave: (val) => updateMutation.mutateAsync({ email: val }),
          },
          {
            label: 'Phone',
            value: contact.phone,
            renderType: 'phone',
            fieldType: 'text',
            placeholder: 'eg: +14155552671',
            onSave: (val) => updateMutation.mutateAsync({ phone: val }),
          },
          {
            label: 'LinkedIn',
            value: contact.linkedinId,
            fieldType: 'text',
            placeholder: 'eg: john-doe-123456',
            onSave: (val) => updateMutation.mutateAsync({ linkedinId: val }),
          },
        ]}
      />

      {/* Notes */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <Subheading>Notes</Subheading>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 min-h-32 bg-white dark:bg-zinc-900 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
          <Editor
            key={`contact-notes-${contactId}`}
            holder="contact-notes-editor"
            data={notesField.value}
            onChange={(val) => notesField.setValue(val)}
            placeholder="No notes yet. Add one..."
          />
        </div>
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

      <Sheet open={isEditSheetOpen} onClose={setIsEditSheetOpen} side="right">
        <SheetHeader>
          <SheetTitle>Edit Contact</SheetTitle>
          <Button plain onClick={() => setIsEditSheetOpen(false)}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </SheetHeader>
        <ContactForm
          mode="edit"
          contact={contact}
          currentUserId={currentUserId ?? 0}
          onSuccess={() => setIsEditSheetOpen(false)}
          onCancel={() => setIsEditSheetOpen(false)}
        />
      </Sheet>
    </>
  );
}
