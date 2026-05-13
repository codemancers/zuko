'use client';

import {
  Button,
  Sheet,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Field,
  Label,
  Input,
  ErrorMessage,
} from '@zuko/ui-kit';
import React, { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
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
  initialData?: {
    id: string;
    name: string;
  };
}

export const CreateTeamDialog = ({
  organizationId,
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: CreateTeamDialogProps) => {
  const queryClient = useQueryClient();
  const isUpdating = !!initialData;
  const form = useForm<TeamFormValues>({
    defaultValues: {
      name: '',
    },
    resolver: zodResolver(teamSchema),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: initialData?.name || '',
      });
    }
  }, [isOpen, initialData, form]);

  const onSubmit = async (data: TeamFormValues) => {
    try {
      let error;
      if (isUpdating) {
        const result = await authClient.organization.updateTeam({
          teamId: initialData.id,
          data: {
            name: data.name,
          },
        });
        error = result.error;
      } else {
        const result = await authClient.organization.createTeam({
          name: data.name,
          organizationId: organizationId,
        });
        error = result.error;
      }

      if (error) {
        console.error('Team operation error:', error);
        form.setError('root', {
          type: 'manual',
          message:
            error.message ||
            `Failed to ${isUpdating ? 'update' : 'create'} team`,
        });
      } else {
        toast.success(
          `Team "${data.name}" ${isUpdating ? 'updated' : 'created'} successfully`,
        );
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
    <Sheet open={isOpen} onClose={handleClose} side="right">
      <SheetHeader>
        <SheetTitle>{isUpdating ? 'Update Team' : 'Create Team'}</SheetTitle>
        <Button
          plain
          onClick={handleClose}
          disabled={form.formState.isSubmitting}
        >
          <XMarkIcon className="h-5 w-5" />
        </Button>
      </SheetHeader>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-1 min-h-0 flex-col"
      >
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
        </div>
        <SheetFooter>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? isUpdating
                ? 'Updating...'
                : 'Creating...'
              : isUpdating
                ? 'Update Team'
                : 'Create Team'}
          </Button>
          <Button
            type="button"
            plain
            onClick={handleClose}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
};
