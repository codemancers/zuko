'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dealsApi,
  type Deal,
  type CreateDealDto,
  type UpdateDealDto,
} from '@/lib/api/deals';
import {
  Button,
  Input,
  Field,
  Label,
  Textarea,
  Description,
  ErrorMessage,
  Select,
} from '@zuko/ui-kit';
import { useRouter } from 'next/navigation';

interface DealFormProps {
  deal?: Deal;
  mode: 'create' | 'edit';
  currentUserId: number;
}

const DEAL_STAGES = [
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'INR', label: 'INR (₹)' },
];

const PRIORITIES = [
  { value: 0, label: 'P0 - Critical' },
  { value: 1, label: 'P1 - High' },
  { value: 2, label: 'P2 - Medium' },
  { value: 3, label: 'P3 - Low' },
  { value: 4, label: 'P4 - Backlog' },
];

export default function DealForm({ deal, mode, currentUserId }: DealFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: deal?.title || '',
    value: deal?.value?.toString() || '',
    currency: deal?.currency || 'USD',
    probability: deal?.probability?.toString() || '50',
    stage: deal?.stage || 'prospecting',
    summary: deal?.summary || '',
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
      router.push('/deals');
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
      summary: formData.summary || undefined,
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
    if (mode === 'edit' && deal) {
      router.push(`/deals/${deal.id}`);
    } else {
      router.push('/deals');
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
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

      {/* Value and Currency */}
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
          <Select
            value={formData.currency}
            onChange={(e) =>
              setFormData({ ...formData, currency: e.target.value })
            }
            disabled={isLoading}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency.value} value={currency.value}>
                {currency.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Stage and Probability */}
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

      {/* Expected Close Date and Priority */}
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

      {/* Source */}
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

      {/* Summary */}
      <Field>
        <Label>Summary</Label>
        <Textarea
          value={formData.summary}
          onChange={(e) =>
            setFormData({ ...formData, summary: e.target.value })
          }
          placeholder="Add notes about this deal..."
          rows={6}
          disabled={isLoading}
        />
        <Description>Free-form notes about this deal</Description>
      </Field>

      {/* Submit Error */}
      {errors.submit && (
        <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">
            {errors.submit}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? 'Saving...'
            : mode === 'create'
              ? 'Create Deal'
              : 'Save Changes'}
        </Button>
        <Button type="button" plain onClick={handleCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
