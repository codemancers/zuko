'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  dealsApi,
  type Deal,
  type CreateDealDto,
  type UpdateDealDto,
} from '@/lib/api/deals';
import { metadataApi } from '@/lib/api/metadata';
import {
  Input,
  Field,
  Label,
  Description,
  ErrorMessage,
  Select,
  Combobox,
  ComboboxOption,
  ComboboxLabel,
  ComboboxDescription,
} from '@zuko/ui-kit';
import { FormActions } from '@/components/shared';
import { useRouter } from 'next/navigation';

interface DealFormProps {
  deal?: Deal;
  mode: 'create' | 'edit';
  currentUserId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const DEAL_STAGES = [
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

const PRIORITIES = [
  { value: 0, label: 'P0 - Critical' },
  { value: 1, label: 'P1 - High' },
  { value: 2, label: 'P2 - Medium' },
  { value: 3, label: 'P3 - Low' },
  { value: 4, label: 'P4 - Backlog' },
];

export default function DealForm({ deal, mode, currentUserId, onSuccess, onCancel }: DealFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: metadataApi.getCurrencies,
  });

  const [formData, setFormData] = useState({
    title: deal?.title || '',
    value: deal?.value?.toString() || '',
    currency: deal?.currency || 'USD',
    probability: deal?.probability?.toString() || '50',
    stage: deal?.stage || 'prospecting',
    expectedCloseDate: deal?.expectedCloseDate
      ? new Date(deal.expectedCloseDate).toISOString().split('T')[0]
      : '',
    source: deal?.source || '',
    priority: deal?.priority?.toString() || '2',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateDealDto) => dealsApi.createDeal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/deals');
      }
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || 'Failed to create deal' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateDealDto) => dealsApi.updateDeal(deal!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', deal!.id] });
      queryClient.invalidateQueries({
        queryKey: ['timeline', 'deal', deal!.id],
      });
      router.push(`/deals/${deal!.id}`);
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || 'Failed to update deal' });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Deal title is required';
    }

    if (formData.value) {
      const value = parseFloat(formData.value);
      if (isNaN(value) || value < 0) {
        newErrors.value = 'Value must be a positive number';
      }
    }

    if (formData.probability) {
      const probability = parseInt(formData.probability);
      if (isNaN(probability) || probability < 0 || probability > 100) {
        newErrors.probability = 'Probability must be between 0 and 100';
      }
    }

    if (formData.priority) {
      const priority = parseInt(formData.priority);
      if (isNaN(priority) || priority < 0 || priority > 4) {
        newErrors.priority = 'Priority must be between 0 and 4';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const baseData = {
      title: formData.title,
      value: formData.value ? parseFloat(formData.value) : undefined,
      currency: formData.currency || undefined,
      probability: formData.probability
        ? parseInt(formData.probability)
        : undefined,
      stage: formData.stage,
      expectedCloseDate: formData.expectedCloseDate || undefined,
      source: formData.source || undefined,
      priority: formData.priority ? parseInt(formData.priority) : undefined,
    };

    if (mode === 'create') {
      createMutation.mutate({
        ...baseData,
        ownerIds: [currentUserId],
        primaryOwnerId: currentUserId,
      });
    } else {
      updateMutation.mutate(baseData);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (mode === 'edit' && deal) {
      router.push(`/deals/${deal.id}`);
    } else {
      router.push('/deals');
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const isSheet = !!onSuccess;

  return (
    <form
      onSubmit={handleSubmit}
      className={clsx(isSheet ? 'flex h-full flex-col' : 'space-y-6')}
    >
      <div className={clsx(isSheet ? 'flex-1 space-y-6' : 'contents')}>
      <Field>
        <Label>Deal Title *</Label>
        <Input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Enterprise License Agreement"
          invalid={!!errors.title}
          disabled={isLoading}
        />
        {errors.title && <ErrorMessage>{errors.title}</ErrorMessage>}
      </Field>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field>
          <Label>Deal Value</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.value}
            onChange={(e) =>
              setFormData({ ...formData, value: e.target.value })
            }
            placeholder="100000"
            invalid={!!errors.value}
            disabled={isLoading}
          />
          <Description>Total value of the deal</Description>
          {errors.value && <ErrorMessage>{errors.value}</ErrorMessage>}
        </Field>

        <Field>
          <Label>Currency</Label>
          <Combobox
            options={currencies}
            value={currencies.find((c) => c.code === formData.currency) || null}
            onChange={(value) => {
              if (value) setFormData({ ...formData, currency: value.code });
            }}
            displayValue={(value) => value?.code}
            disabled={isLoading}
            placeholder="Search currency..."
          >
            {(currency) => (
              <ComboboxOption key={currency.code} value={currency}>
                <ComboboxLabel>{currency.code}</ComboboxLabel>
                <ComboboxDescription>{currency.name}</ComboboxDescription>
                <span className="text-zinc-500 text-xs ml-2">
                  ({currency.symbol})
                </span>
              </ComboboxOption>
            )}
          </Combobox>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field>
          <Label>Stage *</Label>
          <Select
            value={formData.stage}
            onChange={(e) =>
              setFormData({ ...formData, stage: e.target.value })
            }
            disabled={isLoading}
          >
            {DEAL_STAGES.map((stage) => (
              <option key={stage.value} value={stage.value}>
                {stage.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label>Win Probability (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={formData.probability}
            onChange={(e) =>
              setFormData({ ...formData, probability: e.target.value })
            }
            placeholder="50"
            invalid={!!errors.probability}
            disabled={isLoading}
          />
          <Description>0-100%</Description>
          {errors.probability && (
            <ErrorMessage>{errors.probability}</ErrorMessage>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field>
          <Label>Expected Close Date</Label>
          <Input
            type="date"
            value={formData.expectedCloseDate}
            onChange={(e) =>
              setFormData({ ...formData, expectedCloseDate: e.target.value })
            }
            disabled={isLoading}
          />
          <Description>When you expect to close this deal</Description>
        </Field>

        <Field>
          <Label>Priority</Label>
          <Select
            value={formData.priority}
            onChange={(e) =>
              setFormData({ ...formData, priority: e.target.value })
            }
            disabled={isLoading}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field>
        <Label>Source</Label>
        <Input
          type="text"
          value={formData.source}
          onChange={(e) => setFormData({ ...formData, source: e.target.value })}
          placeholder="Inbound, Referral, Cold Outreach, etc."
          disabled={isLoading}
        />
        <Description>How did this deal originate?</Description>
      </Field>

      {errors.submit && <ErrorMessage>{errors.submit}</ErrorMessage>}
      </div>

      <FormActions
        isLoading={isLoading}
        submitLabel={mode === 'create' ? 'Create Deal' : 'Save Changes'}
        onCancel={handleCancel}
      />
    </form>
  );
}
