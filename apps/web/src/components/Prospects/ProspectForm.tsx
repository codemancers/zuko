'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Input } from '@zuko/ui-kit';
import { prospectsApi, type CreateProspectDto } from '@/lib/api/prospects';

interface ProspectFormProps {
  onDone: () => void;
}

const EMPTY: CreateProspectDto = {
  name: '',
  email: '',
  phone: '',
  companyName: '',
  title: '',
  linkedinUrl: '',
};

/**
 * Prospects are created in Zuko. Apollo, Origami and the rest feed the same
 * record through the API — they are sources, not the only way in.
 */
export default function ProspectForm({ onDone }: ProspectFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateProspectDto>(EMPTY);

  const set = (key: keyof CreateProspectDto) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const createMutation = useMutation({
    mutationFn: () => {
      // Send only what was filled in; blanks are not facts about the person.
      const payload: CreateProspectDto = { name: form.name.trim() };
      for (const key of [
        'email',
        'phone',
        'companyName',
        'title',
        'linkedinUrl',
      ] as const) {
        const value = form[key]?.trim();
        if (value) payload[key] = value;
      }
      return prospectsApi.create({ ...payload, source: 'manual' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      toast.success('Prospect added');
      setForm(EMPTY);
      onDone();
    },
    onError: (error: unknown) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not add the prospect',
      ),
  });

  const hasChannel = Boolean(
    form.email?.trim() || form.phone?.trim() || form.linkedinUrl?.trim(),
  );
  const canSubmit = form.name.trim().length > 0 && !createMutation.isPending;

  const fields: { key: keyof CreateProspectDto; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'linkedinUrl', label: 'LinkedIn URL' },
    { key: 'companyName', label: 'Company' },
    { key: 'title', label: 'Title' },
  ];

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) createMutation.mutate();
      }}
    >
      {fields.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-zinc-900 dark:text-white">
            {label}
            {key === 'name' && <span className="text-red-500"> *</span>}
          </label>
          <Input
            className="mt-1"
            value={(form[key] as string) ?? ''}
            onChange={(e) => set(key)(e.target.value)}
          />
        </div>
      ))}

      {!hasChannel && (
        <p className="text-sm text-amber-600 dark:text-amber-500">
          Without an email, phone or LinkedIn URL this prospect cannot be
          contacted or enrolled in a campaign.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button plain type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button color="dark" type="submit" disabled={!canSubmit}>
          {createMutation.isPending ? 'Adding…' : 'Add Prospect'}
        </Button>
      </div>
    </form>
  );
}
