'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companiesApi } from '@/lib/api/companies';
import { getContacts } from '@/server/query-options';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
  Field,
  Label,
  Description,
  ErrorMessage,
} from '@zuko/ui-kit';
import { PlusIcon } from '@heroicons/react/24/outline';

interface AddContactDialogProps {
  companyId: number;
  existingContactIds: number[];
}

export default function AddContactDialog({
  companyId,
  existingContactIds,
}: AddContactDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(
    null,
  );
  const [role, setRole] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();
  const { data: contactsData } = useQuery(getContacts({}));

  // Filter out contacts that are already associated with this company
  const availableContacts =
    contactsData?.contacts.filter(
      (contact) => !existingContactIds.includes(contact.id),
    ) || [];

  const addContactMutation = useMutation({
    mutationFn: () => {
      if (!selectedContactId) {
        throw new Error('No contact selected');
      }
      return companiesApi.addContact(companyId, {
        contactId: selectedContactId,
        role: role || undefined,
        isPrimary,
      });
    },
    onSuccess: async () => {
      // Use refetchQueries to immediately refetch instead of just invalidating
      await queryClient.refetchQueries({ queryKey: ['company', companyId] });
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      setIsOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      setErrors({
        submit: error.message || 'Failed to add contact to company',
      });
    },
  });

  const resetForm = () => {
    setSelectedContactId(null);
    setRole('');
    setIsPrimary(false);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!selectedContactId) {
      newErrors.contact = 'Please select a contact';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    addContactMutation.mutate();
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        Add Contact
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => {
          setIsOpen(false);
          resetForm();
        }}
      >
        <DialogTitle>Add Contact to Company</DialogTitle>
        <DialogDescription>
          Associate a contact with this company. Note: A contact can only be
          associated with one company at a time.
        </DialogDescription>

        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="space-y-4">
              {/* Contact Selection */}
              <Field>
                <Label>Contact *</Label>
                <select
                  value={selectedContactId || ''}
                  onChange={(e) => setSelectedContactId(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  disabled={addContactMutation.isPending}
                >
                  <option value="">Select a contact...</option>
                  {availableContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} {contact.email && `(${contact.email})`}
                    </option>
                  ))}
                </select>
                {availableContacts.length === 0 && (
                  <Description className="text-amber-600">
                    All contacts are already associated with this company.
                  </Description>
                )}
                {errors.contact && (
                  <ErrorMessage>{errors.contact}</ErrorMessage>
                )}
              </Field>

              {/* Role */}
              <Field>
                <Label>Role</Label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g., Employee, Contractor, Advisor"
                  className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  disabled={addContactMutation.isPending}
                />
                <Description>
                  Optional - e.g., Employee, Contractor, Advisor
                </Description>
              </Field>

              {/* Primary Flag */}
              <Field>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700"
                    disabled={addContactMutation.isPending}
                  />
                  <span className="text-sm text-zinc-950 dark:text-white">
                    Primary contact for this company
                  </span>
                </label>
                <Description>
                  Mark as the main contact for this company
                </Description>
              </Field>

              {/* Submit Error */}
              {errors.submit && (
                <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {errors.submit}
                  </p>
                </div>
              )}
            </div>
          </DialogBody>

          <DialogActions>
            <Button
              plain
              onClick={() => {
                setIsOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                addContactMutation.isPending || availableContacts.length === 0
              }
            >
              {addContactMutation.isPending ? 'Adding...' : 'Add Contact'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
