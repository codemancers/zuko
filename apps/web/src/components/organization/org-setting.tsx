'use client';
import {
  Button,
  Divider,
  Heading,
  Input,
  Subheading,
  Text,
} from '@zuko/ui-kit';
import React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

const orgSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
});

type OrgFormValues = z.infer<typeof orgSchema>;

export const OrgSetting = () => {
  const router = useRouter();
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
        console.error(result.error);
        // Let's set a root error if needed or log it
      } else {
        router.push('/chat');
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-4xl">
      <Heading>Settings</Heading>
      <Divider className="my-10 mt-6" />

      <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <div className="space-y-1">
          <Subheading>Organization Name</Subheading>
          <Text>This will be displayed on your public profile.</Text>
        </div>
        <div>
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
            <p className="mt-2 text-sm text-red-500">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>
      </section>

      <Divider className="my-10" soft />

      <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <div className="space-y-1">
          <Subheading>Organization Slug</Subheading>
          <Text>This will be used in your public URL.</Text>
        </div>
        <div>
          <Input aria-label="Organization Slug" {...form.register('slug')} />
          {form.formState.errors.slug && (
            <p className="mt-2 text-sm text-red-500">
              {form.formState.errors.slug.message}
            </p>
          )}
        </div>
      </section>

      <div className="flex justify-end gap-4 mt-10">
        <Button type="button" plain onClick={() => form.reset()}>
          Reset
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
};
