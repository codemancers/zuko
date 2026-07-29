'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { OutputData } from '@editorjs/editorjs';
import {
  Button,
  Field,
  FieldGroup,
  Label,
  ErrorMessage,
  Input,
  SheetFooter,
  MultiSelect,
  MultiCombobox,
} from '@zuko/ui-kit';
import { icpApi, type IcpProfile, type IcpFilters } from '@/lib/api/icp';
import { COUNTRIES } from '@/lib/constants/countries';
import { EMPLOYEE_RANGE_OPTIONS, INDUSTRY_OPTIONS } from '@/lib/constants/icp';
import Editor, { ensureOutputData } from '@/components/Common/Editor/Editor';
import { toast } from 'sonner';

interface IcpFormProps {
  mode: 'create' | 'edit';
  profile?: IcpProfile;
  onSuccess: () => void;
  onCancel: () => void;
}

// ---------- State helpers ----------

interface FilterFields {
  industries: string[];
  employeeRanges: string[];
  revenueMin: string;
  revenueMax: string;
  locations: string[];
}

function filtersToFormState(filters?: IcpFilters): FilterFields {
  return {
    industries: filters?.industries ?? [],
    employeeRanges: filters?.employeeRanges ?? [],
    revenueMin: filters?.revenueRange?.min?.toString() ?? '',
    revenueMax: filters?.revenueRange?.max?.toString() ?? '',
    locations: filters?.locations ?? [],
  };
}

function formStateToFilters(form: FilterFields): IcpFilters {
  const revenueMin = form.revenueMin ? Number(form.revenueMin) : undefined;
  const revenueMax = form.revenueMax ? Number(form.revenueMax) : undefined;

  return {
    ...(form.industries.length > 0 && { industries: form.industries }),
    ...(form.employeeRanges.length > 0 && {
      employeeRanges: form.employeeRanges,
    }),
    ...((revenueMin != null || revenueMax != null) && {
      revenueRange: {
        ...(revenueMin != null && { min: revenueMin }),
        ...(revenueMax != null && { max: revenueMax }),
      },
    }),
    ...(form.locations.length > 0 && { locations: form.locations }),
  };
}

// ---------- Component ----------

export default function IcpForm({
  mode,
  profile,
  onSuccess,
  onCancel,
}: IcpFormProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(profile?.name ?? '');
  const [description, setDescription] = useState<OutputData>(
    ensureOutputData(profile?.description),
  );
  const [filterFields, setFilterFields] = useState<FilterFields>(
    filtersToFormState(profile?.filters),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const locationOptions = COUNTRIES;

  const createMutation = useMutation({
    mutationFn: () =>
      icpApi.createProfile({
        name,
        description: description as unknown as Record<string, unknown>,
        filters: formStateToFilters(filterFields),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icp', 'profiles'] });
      toast.success('ICP profile created');
      onSuccess();
    },
    onError: () => toast.error('Failed to create ICP profile'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      icpApi.updateProfile(profile!.id, {
        name,
        description: description as unknown as Record<string, unknown>,
        filters: formStateToFilters(filterFields),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icp', 'profiles'] });
      queryClient.invalidateQueries({
        queryKey: ['icp', 'profile', profile!.id],
      });
      toast.success('ICP profile updated');
      onSuccess();
    },
    onError: () => toast.error('Failed to update ICP profile'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors['name'] = 'Name is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    if (mode === 'create') createMutation.mutate();
    else updateMutation.mutate();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const setMulti =
    (
      key: keyof Pick<
        FilterFields,
        'industries' | 'employeeRanges' | 'locations'
      >,
    ) =>
    (val: string[]) =>
      setFilterFields((prev) => ({ ...prev, [key]: val }));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <Label>Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. SaaS Mid-Market"
            disabled={isPending}
          />
          {errors['name'] && <ErrorMessage>{errors['name']}</ErrorMessage>}
        </Field>

        <Field>
          <Label>Description</Label>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 min-h-24 shadow-sm">
            <Editor
              key={`icp-description-${profile?.id ?? 'new'}`}
              holder={`icp-description-editor-${profile?.id ?? 'new'}`}
              data={description}
              onChange={setDescription}
              placeholder="Brief description of this ICP…"
            />
          </div>
        </Field>
      </FieldGroup>

      <div className="border-t border-zinc-950/5 pt-4 dark:border-white/5">
        <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Apollo Filters
        </p>
        <FieldGroup>
          <Field>
            <Label>Industries</Label>
            <MultiCombobox
              value={filterFields.industries}
              onChange={setMulti('industries')}
              options={INDUSTRY_OPTIONS}
              placeholder="Select industries…"
            />
          </Field>

          <Field>
            <Label>Employee Count Ranges</Label>
            <MultiSelect
              value={filterFields.employeeRanges}
              onChange={setMulti('employeeRanges')}
              options={EMPLOYEE_RANGE_OPTIONS}
              placeholder="Select ranges…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label>Min Revenue (USD)</Label>
              <Input
                type="number"
                value={filterFields.revenueMin}
                onChange={(e) =>
                  setFilterFields((prev) => ({
                    ...prev,
                    revenueMin: e.target.value,
                  }))
                }
                placeholder="1000000"
                disabled={isPending}
              />
            </Field>
            <Field>
              <Label>Max Revenue (USD)</Label>
              <Input
                type="number"
                value={filterFields.revenueMax}
                onChange={(e) =>
                  setFilterFields((prev) => ({
                    ...prev,
                    revenueMax: e.target.value,
                  }))
                }
                placeholder="50000000"
                disabled={isPending}
              />
            </Field>
          </div>

          <Field>
            <Label>Locations</Label>
            <MultiCombobox
              value={filterFields.locations}
              onChange={setMulti('locations')}
              options={locationOptions}
              placeholder="Search countries…"
            />
          </Field>
        </FieldGroup>
      </div>

      <SheetFooter>
        <Button type="button" plain onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" color="dark" disabled={isPending}>
          {isPending
            ? mode === 'create'
              ? 'Creating…'
              : 'Saving…'
            : mode === 'create'
              ? 'Create Profile'
              : 'Save Changes'}
        </Button>
      </SheetFooter>
    </form>
  );
}
