'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, ErrorMessage, Field, Input } from '@zuko/ui-kit';
import { apolloSequencesApi } from '@/lib/api/apollo';
import { BackLink } from '@/components/shared';
import { toast } from 'sonner';

export default function CampaignForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const icpProfileId = searchParams.get('icpProfileId')
    ? parseInt(searchParams.get('icpProfileId')!, 10)
    : undefined;

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      apolloSequencesApi.createMeta({ name: name.trim(), icpProfileId }),
    onSuccess: (campaign) => {
      toast.success('Campaign created');
      if (icpProfileId) {
        router.push(`/icps/${icpProfileId}?tab=campaigns`);
      } else {
        router.push(`/campaigns/${campaign.id}`);
      }
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');
    createMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-lg pt-8">
      <BackLink
        href={icpProfileId ? `/icps/${icpProfileId}?tab=campaigns` : '/icps'}
      >
        {icpProfileId ? 'Back to ICP' : 'ICP Profiles'}
      </BackLink>

      <div className="mt-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          New Campaign
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Give your campaign a name. You can add sequence steps after creating
          it.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <Field>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 Outreach — SaaS Companies"
            disabled={createMutation.isPending}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          {nameError && <ErrorMessage>{nameError}</ErrorMessage>}
        </Field>

        <div className="flex items-center justify-end gap-2">
          <Button
            plain
            onClick={() =>
              router.push(
                icpProfileId ? `/icps/${icpProfileId}?tab=campaigns` : '/icps',
              )
            }
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            color="dark"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Campaign'}
          </Button>
        </div>
      </div>
    </div>
  );
}
