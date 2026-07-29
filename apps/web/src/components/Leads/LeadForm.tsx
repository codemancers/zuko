'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Field,
  Input,
  Label,
  Select,
  Textarea,
  SheetFooter,
} from '@zuko/ui-kit';
import { leadsApi } from '@/lib/api/leads';
import type { CreateLeadDto, UpdateLeadDto, Lead } from '@/lib/api/leads';
import { icpApi } from '@/lib/api/icp';
import { toast } from 'sonner';

interface Props {
  lead?: Lead;
  onSuccess?: () => void;
}

const LeadForm = ({ lead, onSuccess }: Props) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: lead?.name ?? '',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    companyName: lead?.companyName ?? '',
    title: lead?.title ?? '',
    linkedinUrl: lead?.linkedinUrl ?? '',
    status: lead?.status ?? 'replied',
    source: lead?.source ?? 'manual',
    icpProfileId: lead?.icpProfileId ? String(lead.icpProfileId) : '',
    notes: lead?.notes ?? '',
  });

  const { data: icpProfiles } = useQuery({
    queryKey: ['icp', 'profiles', 'list'],
    queryFn: () => icpApi.listProfiles(1, 100),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (lead) {
        const dto: UpdateLeadDto = {
          name: form.name || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          companyName: form.companyName || undefined,
          title: form.title || undefined,
          status: form.status,
          notes: form.notes || undefined,
        };
        return leadsApi.update(lead.id, dto);
      }
      const dto: CreateLeadDto = {
        icpProfileId: Number(form.icpProfileId),
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        companyName: form.companyName || undefined,
        title: form.title || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
        status: form.status,
        source: form.source,
        notes: form.notes || undefined,
      };
      return leadsApi.create(dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(lead ? 'Lead updated' : 'Lead created');
      onSuccess?.();
    },
    onError: () =>
      toast.error(lead ? 'Failed to update lead' : 'Failed to create lead'),
  });

  const set =
    (key: string) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {!lead && (
          <Field>
            <Label>ICP Profile *</Label>
            <Select value={form.icpProfileId} onChange={set('icpProfileId')}>
              <option value="">Select ICP Profile</option>
              {icpProfiles?.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field>
          <Label>Name *</Label>
          <Input
            value={form.name}
            onChange={set('name')}
            placeholder="Full name"
          />
        </Field>

        <Field>
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="email@example.com"
          />
        </Field>

        <Field>
          <Label>Phone</Label>
          <Input
            value={form.phone}
            onChange={set('phone')}
            placeholder="+1 555 000 0000"
          />
        </Field>

        <Field>
          <Label>Company</Label>
          <Input
            value={form.companyName}
            onChange={set('companyName')}
            placeholder="Company name"
          />
        </Field>

        <Field>
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={set('title')}
            placeholder="Job title"
          />
        </Field>

        {!lead && (
          <Field>
            <Label>LinkedIn URL</Label>
            <Input
              value={form.linkedinUrl}
              onChange={set('linkedinUrl')}
              placeholder="https://linkedin.com/in/..."
            />
          </Field>
        )}

        <Field>
          <Label>Status</Label>
          <Select value={form.status} onChange={set('status')}>
            <option value="replied">Replied</option>
            <option value="interested">Interested</option>
            <option value="not_interested">Not Interested</option>
            <option value="converted">Converted</option>
          </Select>
        </Field>

        {!lead && (
          <Field>
            <Label>Source</Label>
            <Select value={form.source} onChange={set('source')}>
              <option value="manual">Manual</option>
              <option value="apollo">Apollo</option>
              <option value="origami">Origami</option>
              <option value="linkedin">LinkedIn</option>
            </Select>
          </Field>
        )}

        <Field>
          <Label>Notes</Label>
          <Textarea
            value={form.notes}
            onChange={set('notes')}
            rows={3}
            placeholder="Any notes..."
          />
        </Field>
      </div>

      <SheetFooter>
        <Button
          color="dark"
          onClick={() => mutate()}
          disabled={isPending || (!lead && !form.icpProfileId) || !form.name}
        >
          {isPending ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'}
        </Button>
      </SheetFooter>
    </div>
  );
};

export default LeadForm;
