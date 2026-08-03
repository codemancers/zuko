'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  EMPLOYEE_RANGE_OPTIONS,
  INDUSTRY_OPTIONS,
  REGION_OPTIONS,
  SUB_INDUSTRY_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  REVENUE_STATUS_OPTIONS,
  FUNDING_STATUS_OPTIONS,
  FUNDING_STAGE_OPTIONS,
  WORKFLOW_COMPLEXITY_OPTIONS,
  OPERATIONAL_BOTTLENECK_OPTIONS,
  AUTOMATION_OPPORTUNITY_OPTIONS,
  AI_TRANSFORMATION_SIGNAL_OPTIONS,
  BUDGET_LIKELIHOOD_OPTIONS,
  PRODUCT_MATURITY_OPTIONS,
  CONSULTING_FIT_OPTIONS,
} from '@/lib/constants/icp';
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
  region: string[];
  subIndustry: string[];
  companyType: string[];
  revenueStatus: string[];
  fundingStatus: string[];
  fundingStage: string[];
  primaryBuyerTitle: string[];
  secondaryBuyerTitles: string[];
  workflowComplexity: string[];
  operationalBottlenecks: string[];
  automationOpportunity: string[];
  aiTransformationSignal: string[];
  budgetLikelihood: string[];
  productMaturity: string[];
  consultingFit: string[];
  exclusionTags: string[];
}

function filtersToFormState(filters?: IcpFilters): FilterFields {
  return {
    industries: filters?.industries ?? [],
    employeeRanges: filters?.employeeRanges ?? [],
    revenueMin: filters?.revenueRange?.min?.toString() ?? '',
    revenueMax: filters?.revenueRange?.max?.toString() ?? '',
    locations: filters?.locations ?? [],
    region: filters?.region ?? [],
    subIndustry: filters?.subIndustry ?? [],
    companyType: filters?.companyType ?? [],
    revenueStatus: filters?.revenueStatus ?? [],
    fundingStatus: filters?.fundingStatus ?? [],
    fundingStage: filters?.fundingStage ?? [],
    primaryBuyerTitle: filters?.primaryBuyerTitle ?? [],
    secondaryBuyerTitles: filters?.secondaryBuyerTitles ?? [],
    workflowComplexity: filters?.workflowComplexity ?? [],
    operationalBottlenecks: filters?.operationalBottlenecks ?? [],
    automationOpportunity: filters?.automationOpportunity ?? [],
    aiTransformationSignal: filters?.aiTransformationSignal ?? [],
    budgetLikelihood: filters?.budgetLikelihood ?? [],
    productMaturity: filters?.productMaturity ?? [],
    consultingFit: filters?.consultingFit ?? [],
    exclusionTags: filters?.exclusionTags ?? [],
  };
}

function formStateToFilters(form: FilterFields): IcpFilters {
  const revenueMin = form.revenueMin ? Number(form.revenueMin) : undefined;
  const revenueMax = form.revenueMax ? Number(form.revenueMax) : undefined;

  const multi = <K extends keyof FilterFields>(key: K) => {
    const v = form[key] as string[];
    return v.length > 0 ? v : undefined;
  };

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
    region: multi('region'),
    subIndustry: multi('subIndustry'),
    companyType: multi('companyType'),
    revenueStatus: multi('revenueStatus'),
    fundingStatus: multi('fundingStatus'),
    fundingStage: multi('fundingStage'),
    primaryBuyerTitle: multi('primaryBuyerTitle'),
    secondaryBuyerTitles: multi('secondaryBuyerTitles'),
    workflowComplexity: multi('workflowComplexity'),
    operationalBottlenecks: multi('operationalBottlenecks'),
    automationOpportunity: multi('automationOpportunity'),
    aiTransformationSignal: multi('aiTransformationSignal'),
    budgetLikelihood: multi('budgetLikelihood'),
    productMaturity: multi('productMaturity'),
    consultingFit: multi('consultingFit'),
    exclusionTags: multi('exclusionTags'),
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
  const [filterFields, setFilterFields] = useState<FilterFields>(
    filtersToFormState(profile?.filters),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: () =>
      icpApi.createProfile({
        name,
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

  const setMulti = (key: keyof FilterFields) => (val: string[]) =>
    setFilterFields((prev) => ({ ...prev, [key]: val }));

  const section = (title: string) => (
    <div className="border-t border-zinc-950/5 pt-4 dark:border-white/5">
      <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </p>
    </div>
  );

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
      </FieldGroup>

      {/* ── Company Profile ── */}
      {section('Company Profile')}
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
          <Label>Sub-industry</Label>
          <MultiCombobox
            value={filterFields.subIndustry}
            onChange={setMulti('subIndustry')}
            options={SUB_INDUSTRY_OPTIONS}
            placeholder="Select sub-industries…"
          />
        </Field>

        <Field>
          <Label>Company Type</Label>
          <MultiSelect
            value={filterFields.companyType}
            onChange={setMulti('companyType')}
            options={COMPANY_TYPE_OPTIONS}
            placeholder="Select company types…"
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
          <Label>Revenue Status</Label>
          <MultiSelect
            value={filterFields.revenueStatus}
            onChange={setMulti('revenueStatus')}
            options={REVENUE_STATUS_OPTIONS}
            placeholder="Select revenue status…"
          />
        </Field>
      </FieldGroup>

      {/* ── Location ── */}
      {section('Location')}
      <FieldGroup>
        <Field>
          <Label>Countries</Label>
          <MultiCombobox
            value={filterFields.locations}
            onChange={setMulti('locations')}
            options={COUNTRIES}
            placeholder="Search countries…"
          />
        </Field>

        <Field>
          <Label>Region</Label>
          <MultiSelect
            value={filterFields.region}
            onChange={setMulti('region')}
            options={REGION_OPTIONS}
            placeholder="Select regions…"
          />
        </Field>
      </FieldGroup>

      {/* ── Funding ── */}
      {section('Funding')}
      <FieldGroup>
        <Field>
          <Label>Funding Status</Label>
          <MultiSelect
            value={filterFields.fundingStatus}
            onChange={setMulti('fundingStatus')}
            options={FUNDING_STATUS_OPTIONS}
            placeholder="Select funding status…"
          />
        </Field>

        <Field>
          <Label>Funding Stage</Label>
          <MultiSelect
            value={filterFields.fundingStage}
            onChange={setMulti('fundingStage')}
            options={FUNDING_STAGE_OPTIONS}
            placeholder="Select funding stage…"
          />
        </Field>
      </FieldGroup>

      {/* ── Buyer Profile ── */}
      {section('Buyer Profile')}
      <FieldGroup>
        <Field>
          <Label>Primary Buyer Title</Label>
          <MultiCombobox
            value={filterFields.primaryBuyerTitle}
            onChange={setMulti('primaryBuyerTitle')}
            options={[]}
            placeholder="e.g. VP of Engineering, CTO…"
          />
        </Field>

        <Field>
          <Label>Secondary Buyer Titles</Label>
          <MultiCombobox
            value={filterFields.secondaryBuyerTitles}
            onChange={setMulti('secondaryBuyerTitles')}
            options={[]}
            placeholder="e.g. Head of IT, Engineering Manager…"
          />
        </Field>
      </FieldGroup>

      {/* ── Fit Signals ── */}
      {section('Fit Signals')}
      <FieldGroup>
        <Field>
          <Label>Workflow Complexity</Label>
          <MultiSelect
            value={filterFields.workflowComplexity}
            onChange={setMulti('workflowComplexity')}
            options={WORKFLOW_COMPLEXITY_OPTIONS}
            placeholder="Select…"
          />
        </Field>

        <Field>
          <Label>Operational Bottlenecks</Label>
          <MultiSelect
            value={filterFields.operationalBottlenecks}
            onChange={setMulti('operationalBottlenecks')}
            options={OPERATIONAL_BOTTLENECK_OPTIONS}
            placeholder="Select bottlenecks…"
          />
        </Field>

        <Field>
          <Label>Automation Opportunity</Label>
          <MultiSelect
            value={filterFields.automationOpportunity}
            onChange={setMulti('automationOpportunity')}
            options={AUTOMATION_OPPORTUNITY_OPTIONS}
            placeholder="Select…"
          />
        </Field>

        <Field>
          <Label>AI Transformation Signal</Label>
          <MultiSelect
            value={filterFields.aiTransformationSignal}
            onChange={setMulti('aiTransformationSignal')}
            options={AI_TRANSFORMATION_SIGNAL_OPTIONS}
            placeholder="Select…"
          />
        </Field>

        <Field>
          <Label>Budget Likelihood</Label>
          <MultiSelect
            value={filterFields.budgetLikelihood}
            onChange={setMulti('budgetLikelihood')}
            options={BUDGET_LIKELIHOOD_OPTIONS}
            placeholder="Select…"
          />
        </Field>

        <Field>
          <Label>Product Maturity</Label>
          <MultiSelect
            value={filterFields.productMaturity}
            onChange={setMulti('productMaturity')}
            options={PRODUCT_MATURITY_OPTIONS}
            placeholder="Select…"
          />
        </Field>

        <Field>
          <Label>Consulting Fit</Label>
          <MultiSelect
            value={filterFields.consultingFit}
            onChange={setMulti('consultingFit')}
            options={CONSULTING_FIT_OPTIONS}
            placeholder="Select…"
          />
        </Field>
      </FieldGroup>

      {/* ── Exclusions ── */}
      {section('Exclusions')}
      <FieldGroup>
        <Field>
          <Label>Exclusion Tags</Label>
          <MultiCombobox
            value={filterFields.exclusionTags}
            onChange={setMulti('exclusionTags')}
            options={[]}
            placeholder="e.g. competitor, partner, existing-customer…"
          />
        </Field>
      </FieldGroup>

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
