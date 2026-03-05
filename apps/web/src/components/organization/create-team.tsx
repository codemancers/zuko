'use client';

import { Button, Divider, Heading, Input, Subheading, Text } from '@zuko/ui-kit';
import React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const teamSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

type TeamFormValues = z.infer<typeof teamSchema>;

interface CreateTeamProps {
  organizationId: string;
  slug: string;
}

export const CreateTeam = ({ organizationId, slug }: CreateTeamProps) => {
  const router = useRouter();
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
        router.push(`/organization/${slug}/teams`);
        router.refresh();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      form.setError('root', {
        type: 'manual',
        message: 'An unexpected error occurred. Please try again.',
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl">
      <Heading>Create Team</Heading>
      <Text className="mt-1">Teams allow you to group members within your organization.</Text>
      
      {form.formState.errors.root && (
        <p className="mt-4 p-3 bg-red-50 border border-red-200 text-sm text-red-600 rounded-lg">
          {form.formState.errors.root.message}
        </p>
      )}
      
      <Divider className="my-10 mt-6" />

      <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <div className="space-y-1">
          <Subheading>Team Name</Subheading>
          <Text>Give your team a descriptive name.</Text>
        </div>
        <div>
          <Input
            aria-label="Team Name"
            placeholder="e.g. Engineering, Marketing"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p className="mt-2 text-sm text-red-500">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>
      </section>

      <div className="flex justify-end gap-4 mt-10">
        <Button
          type="button"
          plain
          onClick={() => router.back()}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="cursor-pointer"
        >
          {form.formState.isSubmitting ? 'Creating...' : 'Create Team'}
        </Button>
      </div>
    </form>
  );
};
