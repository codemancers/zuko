'use client';

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
  ErrorMessage,
} from '@zuko/ui-kit';
import React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const teamSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

type TeamFormValues = z.infer<typeof teamSchema>;

interface CreateTeamDialogProps {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTeamDialog = ({
  organizationId,
  isOpen,
  onClose,
  onSuccess,
}: CreateTeamDialogProps) => {
  const queryClient = useQueryClient();
  const form = useForm<TeamFormValues>({
    defaultValues: {
      name: '',
    },
    resolver: zodResolver(teamSchema),
  });

  const onSubmit = async (data: TeamFormValues) => {
    try {
      const result = await authClient.organization.createTeam({
        name: data.name,
        organizationId: organizationId,
      });

      if (result.error) {
        console.error('Team creation error:', result.error);
        form.setError('root', {
          type: 'manual',
          message: result.error.message || 'Failed to create team',
        });
      } else {
        toast.success(`Team "${data.name}" created successfully`);
        queryClient.invalidateQueries({
          queryKey: ['organization', organizationId, 'teams'],
        });
        form.reset();
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      form.setError('root', {
        type: 'manual',
        message: 'An unexpected error occurred. Please try again.',
      });
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>Create Team</DialogTitle>
      <DialogDescription>
        Teams allow you to group members within your organization.
      </DialogDescription>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <DialogBody className="space-y-4">
          <Field>
            <Label>Team Name</Label>
            <Input
              placeholder="e.g. Engineering, Marketing"
              {...form.register('name')}
              disabled={form.formState.isSubmitting}
            />
            {form.formState.errors.name && (
              <ErrorMessage>{form.formState.errors.name.message}</ErrorMessage>
            )}
            {form.formState.errors.root && (
              <ErrorMessage>{form.formState.errors.root.message}</ErrorMessage>
            )}
          </Field>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={handleClose} disabled={form.formState.isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Creating...' : 'Create Team'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
