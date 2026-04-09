'use client';
import { Button, Divider, ErrorMessage, Field, Heading, Input, Subheading } from '@zuko/ui-kit';
import React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { authClient } from '@/lib/auth-client';

const orgSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
});

type OrgFormValues = z.infer<typeof orgSchema>;

export const CreateOrg = () => {
  const form = useForm<OrgFormValues>({
    defaultValues: {
      name: '',
      slug: '',
    },
    resolver: zodResolver(orgSchema),
  });

  const onSubmit = async (data: OrgFormValues) => {
    try {
      const result = await authClient.organization.create({
        name: data.name,
        slug: data.slug,
      });

      if (result.error) {
        console.error('Organization creation error:', result.error);
        if (
          result.error.status === 409 ||
          result.error.message?.toLowerCase().includes('slug')
        ) {
          form.setError('slug', {
            type: 'manual',
            message: 'This slug is already taken. Please choose another one.',
          });
        } else {
          form.setError('root', {
            type: 'manual',
            message: result.error.message || 'Failed to create organization',
          });
        }
      } else {
        const { id } = result.data;
        try {
          const { error: setActiveError } =
            await authClient.organization.setActive({
              organizationId: id.toString(),
            });

          if (setActiveError) {
            console.error('Failed to set active organization:', setActiveError);
          }
        } catch (err) {
          console.error('Error setting active organization:', err);
        }
        // Use window.location.href to ensure server-side components pick up the new session cookie
        window.location.href = '/chat';
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="">
      <Heading>Create Organization</Heading>
      {form.formState.errors.root && (
        <ErrorMessage>{form.formState.errors.root.message}</ErrorMessage>
      )}
      <Divider className="my-10 mt-6" />

      <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <div className="space-y-1">
          <Subheading>Organization Name</Subheading>
        </div>
        <Field>
          <Input
            aria-label="Organization Name"
            {...form.register('name', {
              onChange: (e) => {
                if (!form.formState.dirtyFields.slug) {
                  const generatedSlug = e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)+/g, '');
                  form.setValue('slug', generatedSlug, {
                    shouldValidate: true,
                  });
                }
              },
            })}
          />
          {form.formState.errors.name && (
            <ErrorMessage>{form.formState.errors.name.message}</ErrorMessage>
          )}
        </Field>
      </section>

      <Divider className="my-10" soft />

      <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <div className="space-y-1">
          <Subheading>Organization Slug</Subheading>
        </div>
        <Field>
          <Input aria-label="Organization Slug" {...form.register('slug')} />
          {form.formState.errors.slug && (
            <ErrorMessage>{form.formState.errors.slug.message}</ErrorMessage>
          )}
        </Field>
      </section>

      <div className="flex justify-end gap-4 mt-10">
        <Button
          type="button"
          plain
          onClick={() => form.reset()}
        >
          Reset
        </Button>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
};
