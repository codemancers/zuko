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
  Description,
  ErrorMessage,
} from '@zuko/ui-kit';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { getTeams, getTeamMembers } from '@/server/query-options';

interface RemoveFromTeamsDialogProps {
  organizationId: string;
  userId: string;
  memberName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RemoveFromTeamsDialog = ({
  organizationId,
  userId,
  memberName,
  isOpen,
  onClose,
  onSuccess,
}: RemoveFromTeamsDialogProps) => {
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    ...getTeams(organizationId),
    enabled: isOpen && !!organizationId,
  });

  const teamMemberResults = useQueries({
    queries: teams.map((team) => ({
      ...getTeamMembers(team.id),
      enabled: isOpen,
    })),
  });

  // Only show teams this member actually belongs to
  const memberTeams = teams.filter((_, i) =>
    teamMemberResults[i].data?.some((tm) => tm.userId === userId),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) {
      setError('Please select a team');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { error: authError } =
        await authClient.organization.removeTeamMember({
          teamId: selectedTeamId,
          userId,
        });

      if (authError) {
        setError(authError.message || 'Failed to remove member from team');
        return;
      }

      toast.success(`${memberName} removed from team`);
      queryClient.invalidateQueries({
        queryKey: ['team', selectedTeamId, 'members'],
      });
      setSelectedTeamId('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error removing from team:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTeamId('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>Remove from Team</DialogTitle>
      <DialogDescription>
        Select a team to remove <strong>{memberName}</strong> from.
      </DialogDescription>
      <form onSubmit={handleSubmit}>
        <DialogBody className="space-y-4">
          <Field>
            <Label>Team</Label>
            <Combobox<{ id: string; name: string }>
              value={memberTeams.find((t) => t.id === selectedTeamId)}
              options={memberTeams}
              displayValue={(team) => team?.name || ''}
              onChange={(team) => {
                if (team) {
                  setSelectedTeamId(team.id);
                }
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
            {memberTeams.length === 0 && (
              <Description>
                This member is not in any teams.
              </Description>
            )}
          </Field>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            color="red"
            disabled={isLoading || memberTeams.length === 0}
          >
            {isLoading ? 'Removing...' : 'Remove from Team'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
