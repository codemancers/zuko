'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
  Field,
  Label,
  Input,
  Combobox,
  ComboboxOption,
  ComboboxLabel,
  ErrorMessage,
} from '@zuko/ui-kit';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';

interface AddMemberDialogProps {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddMemberDialog = ({
  organizationId,
  isOpen,
  onClose,
  onSuccess,
}: AddMemberDialogProps) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'owner'>('member');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error: authError } = await authClient.organization.inviteMember({
        email,
        role,
        organizationId,
      });

      if (authError) {
        setError(authError.message || 'Failed to send invitation');
        return;
      }

      toast.success('Invitation sent successfully');
      setEmail('');
      setRole('member');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error sending invitation:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Add Member</DialogTitle>
      <DialogDescription>
        Add a new member to your organization by their email address.
      </DialogDescription>
      <form onSubmit={handleSubmit}>
        <DialogBody className="space-y-4">
          <Field>
            <Label>Email Address</Label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
            {error && <ErrorMessage>{error}</ErrorMessage>}
          </Field>
          <Field>
            <Label>Role</Label>
            <Combobox<{ value: string; label: string }>
              value={[
                { value: 'member', label: 'Member' },
                { value: 'admin', label: 'Admin' },
                { value: 'owner', label: 'Owner' },
              ].find((o) => o.value === role)}
              options={[
                { value: 'member', label: 'Member' },
                { value: 'admin', label: 'Admin' },
                { value: 'owner', label: 'Owner' },
              ]}
              displayValue={(option) => option?.label}
              onChange={(option: { value: string; label: string } | null) => {
                if (option)
                  setRole(option.value as 'admin' | 'member' | 'owner');
              }}
              disabled={isLoading}
            >
              {(option) => (
                <ComboboxOption value={option}>
                  <ComboboxLabel>{option.label}</ComboboxLabel>
                </ComboboxOption>
              )}
            </Combobox>
          </Field>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
