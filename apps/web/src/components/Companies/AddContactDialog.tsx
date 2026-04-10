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
  Select,
  Input,
  Switch,
  Text,
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
      await queryClient.invalidateQueries({ queryKey: ['timeline', 'company', companyId] });
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
                <Select
                  value={selectedContactId || ''}
                  onChange={(e) => setSelectedContactId(Number(e.target.value))}
                  disabled={addContactMutation.isPending}
                >
                  <option value="">Select a contact...</option>
                  {availableContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} {contact.email && `(${contact.email})`}
                    </option>
                  ))}
                </Select>
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
                <Input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g., Employee, Contractor, Advisor"
                  disabled={addContactMutation.isPending}
                />
                <Description>
                  Optional - e.g., Employee, Contractor, Advisor
                </Description>
              </Field>

              {/* Primary Flag */}
              <Field>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isPrimary}
                    onChange={setIsPrimary}
                    color="blue"
                    disabled={addContactMutation.isPending}
                  />
                  <Text>Primary contact for this company</Text>
                </div>
                <Description>
                  Mark as the main contact for this company
                </Description>
              </Field>

              {/* Submit Error */}
              {errors.submit && <ErrorMessage>{errors.submit}</ErrorMessage>}
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
