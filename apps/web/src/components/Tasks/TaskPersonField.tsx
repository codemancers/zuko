'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Field, Input, Label, Select } from '@zuko/ui-kit';
import { contactsApi } from '@/lib/api/contacts';
import { prospectsApi } from '@/lib/api/prospects';

export type TaskPerson = {
  type: 'contact' | 'prospect';
  id: number;
  name: string;
};
const key = (person: TaskPerson) => `${person.type}:${person.id}`;

export function TaskPersonField({
  value,
  onChange,
  organizationId,
  disabled,
}: {
  value: TaskPerson | null;
  onChange: (person: TaskPerson | null) => void;
  organizationId: string;
  disabled: boolean;
}) {
  const [search, setSearch] = useState('');
  const contacts = useQuery({
    queryKey: ['task-person-search', organizationId, 'contact', search],
    queryFn: () =>
      contactsApi.getContacts({ search: search.trim(), limit: 25 }),
    enabled: !!organizationId && !!search.trim(),
  });
  const prospects = useQuery({
    queryKey: ['task-person-search', organizationId, 'prospect', search],
    queryFn: () => prospectsApi.list({ search: search.trim(), perPage: 25 }),
    enabled: !!organizationId && !!search.trim(),
  });
  const results: TaskPerson[] = [
    ...(contacts.data?.contacts ?? []).map((p) => ({
      type: 'contact' as const,
      id: p.id,
      name: p.name,
    })),
    ...(prospects.data?.data ?? []).map((p) => ({
      type: 'prospect' as const,
      id: p.id,
      name: p.name,
    })),
  ];
  const options = value
    ? [value, ...results.filter((p) => key(p) !== key(value))]
    : results;
  return (
    <>
      <Field>
        <Label>Search existing people</Label>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search contacts and prospects…"
          disabled={disabled}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Optional. Search by name; up to 25 results of each type. Refine your
          search if needed.
        </p>
        {(contacts.isFetching || prospects.isFetching) && (
          <output>Searching people…</output>
        )}
        {(contacts.isError || prospects.isError) && (
          <p role="alert">
            Some people could not be loaded. Try searching again; your selection
            is unchanged.
          </p>
        )}
      </Field>
      <Field>
        <Label>Related contact or prospect</Label>
        <Select
          value={value ? key(value) : ''}
          onChange={(event) =>
            onChange(options.find((p) => key(p) === event.target.value) ?? null)
          }
          disabled={disabled}
        >
          <option value="">No linked person</option>
          {options.map((p) => (
            <option key={key(p)} value={key(p)}>
              {p.name} — {p.type} #{p.id}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
