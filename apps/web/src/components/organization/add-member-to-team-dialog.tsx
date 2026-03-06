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
  Combobox,
  ComboboxOption,
  ComboboxLabel,
  ErrorMessage,
} from '@zuko/ui-kit';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { getTeams, getMembers } from '@/server/query-options';

interface AddMemberToTeamDialogProps {
  organizationId: string;
  /** If provided, skips the member picker and pre-selects this member. */
  userId?: string;
  memberName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddMemberToTeamDialog = ({
  organizationId,
  userId: preselectedUserId,
  memberName,
  isOpen,
  onClose,
  onSuccess,
}: AddMemberToTeamDialogProps) => {
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(preselectedUserId || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: teams = [] } = useQuery({
    ...getTeams(organizationId),
    enabled: isOpen && !!organizationId,
  });

  const { data: members = [] } = useQuery({
    ...getMembers(organizationId),
    enabled: isOpen && !!organizationId && !preselectedUserId,
  });

  const effectiveUserId = preselectedUserId || selectedUserId;
  const effectiveName = memberName || 'the selected member';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) {
      setError('Please select a team');
      return;
    }
    if (!effectiveUserId) {
      setError('Please select a member');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { error: authError } = await authClient.organization.addTeamMember({
        userId: effectiveUserId,
        teamId: selectedTeamId,
      });

      if (authError) {
        setError(authError.message || 'Failed to add member to team');
        return;
      }

      toast.success(`${effectiveName} added to team`);
      setSelectedTeamId('');
      setSelectedUserId('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error adding member to team:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTeamId('');
    setSelectedUserId('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>Add to Team</DialogTitle>
      <DialogDescription>
        {preselectedUserId ? (
          <>
            Select a team to add <strong>{memberName}</strong> to.
          </>
        ) : (
          'Select a member and team to add them to.'
        )}
      </DialogDescription>
      <form onSubmit={handleSubmit}>
        <DialogBody className="space-y-4">
          {!preselectedUserId && (
            <Field>
              <Label>Member</Label>
              <Combobox<{
                id: string;
                user: { id: string; name: string | null; email: string };
              }>
                value={members.find((m) => m.user.id === selectedUserId)}
                options={members}
                displayValue={(member) =>
                  member ? member.user.name || member.user.email : ''
                }
                onChange={(member) => {
                  if (member) setSelectedUserId(member.user.id);
                }}
                disabled={isLoading}
                placeholder="Select a member..."
              >
                {(member) => (
                  <ComboboxOption value={member}>
                    <ComboboxLabel>
                      {member.user.name || member.user.email}
                    </ComboboxLabel>
                  </ComboboxOption>
                )}
              </Combobox>
            </Field>
          )}
          <Field>
            <Label>Team</Label>
            <Combobox<{ id: string; name: string }>
              value={teams.find((t) => t.id === selectedTeamId)}
              options={teams}
              displayValue={(team) => team?.name || ''}
              onChange={(team) => {
                if (team) setSelectedTeamId(team.id);
              }}
              disabled={isLoading}
              placeholder="Select a team..."
            >
              {(team) => (
                <ComboboxOption value={team}>
                  <ComboboxLabel>{team.name}</ComboboxLabel>
                </ComboboxOption>
              )}
            </Combobox>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            {teams.length === 0 && (
              <p className="mt-1 text-sm text-zinc-500">
                No teams available. Create a team first.
              </p>
            )}
          </Field>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || teams.length === 0}>
            {isLoading ? 'Adding...' : 'Add to Team'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
