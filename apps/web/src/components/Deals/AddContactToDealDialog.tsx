'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '@/lib/api/deals';
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

interface AddContactToDealDialogProps {
  dealId: number;
  existingContactIds: number[];
}

export default function AddContactToDealDialog({
  dealId,
  existingContactIds,
}: AddContactToDealDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(
    null,
  );
  const [role, setRole] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();
  const { data: contactsData } = useQuery(getContacts({}));

  // Filter out contacts that are already associated with this deal
  const availableContacts =
    contactsData?.contacts.filter(
      (contact) => !existingContactIds.includes(contact.id),
    ) || [];

  const addContactMutation = useMutation({
    mutationFn: () => {
      if (!selectedContactId) {
        throw new Error('No contact selected');
      }
      return dealsApi.addContact(dealId, {
        contactId: selectedContactId,
        role: role || undefined,
        isPrimary,
      });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['deal', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['deals'] });
      await queryClient.invalidateQueries({ queryKey: ['timeline', 'deal', dealId] });
      setIsOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || 'Failed to add contact to deal' });
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
        <DialogTitle>Add Contact to Deal</DialogTitle>
        <DialogDescription>
          Associate a contact person with this deal.
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
                    All contacts are already associated with this deal.
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
                  placeholder="e.g., Decision Maker, Influencer, Champion"
                  disabled={addContactMutation.isPending}
                />
                <Description>
                  Optional - e.g., Decision Maker, Influencer, Champion
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
                  <Text>Primary contact for this deal</Text>
                </div>
                <Description>
                  Mark as the main contact person for this deal
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
