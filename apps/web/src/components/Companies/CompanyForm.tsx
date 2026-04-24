'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  companiesApi,
  type Company,
  type CreateCompanyDto,
  type UpdateCompanyDto,
} from '@/lib/api/companies';
import {
  Input,
  Field,
  Label,
  Description,
  ErrorMessage,
} from '@zuko/ui-kit';
import { FormActions } from '@/components/shared';
import { useRouter } from 'next/navigation';

interface CompanyFormProps {
  company?: Company;
  mode: 'create' | 'edit';
  currentUserId: number;
}

export default function CompanyForm({
  company,
  mode,
  currentUserId,
}: CompanyFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    companyName: company?.companyName || '',
    website: company?.website || '',
    linkedinUrl: company?.linkedinUrl || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateCompanyDto) => companiesApi.createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      router.push('/companies');
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || 'Failed to create company' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCompanyDto) =>
      companiesApi.updateCompany(company!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company', company!.id] });
      queryClient.invalidateQueries({ queryKey: ['timeline', 'company', company!.id] });
      router.push(`/companies/${company!.id}`);
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || 'Failed to update company' });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    if (formData.website) {
      try {
        const url = new URL(formData.website);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          newErrors.website =
            'Website must be a valid URL (e.g., https://example.com)';
        }
      } catch {
        newErrors.website =
          'Website must be a valid URL (e.g., https://example.com)';
      }
    }

    if (formData.linkedinUrl) {
      try {
        const url = new URL(formData.linkedinUrl);
        if (!url.hostname.includes('linkedin.com')) {
          newErrors.linkedinUrl = 'LinkedIn URL must be from linkedin.com';
        }
      } catch {
        newErrors.linkedinUrl =
          'LinkedIn URL must be a valid URL (e.g., https://www.linkedin.com/company/example)';
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

    if (mode === 'create') {
      createMutation.mutate({
        ...formData,
        website: formData.website || undefined,
        linkedinUrl: formData.linkedinUrl || undefined,
        ownerIds: [currentUserId],
        primaryOwnerId: currentUserId,
      });
    } else {
      updateMutation.mutate({
        ...formData,
        website: formData.website || undefined,
        linkedinUrl: formData.linkedinUrl || undefined,
      });
    }
  };

  const handleCancel = () => {
    if (mode === 'edit' && company) {
      router.push(`/companies/${company.id}`);
    } else {
      router.push('/companies');
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field>
        <Label>Company Name *</Label>
        <Input
          type="text"
          value={formData.companyName}
          onChange={(e) =>
            setFormData({ ...formData, companyName: e.target.value })
          }
          placeholder="Acme Inc."
          invalid={!!errors.companyName}
          disabled={isLoading}
        />
        {errors.companyName && (
          <ErrorMessage>{errors.companyName}</ErrorMessage>
        )}
      </Field>

      <Field>
        <Label>Website</Label>
        <Input
          type="url"
          value={formData.website}
          onChange={(e) =>
            setFormData({ ...formData, website: e.target.value })
          }
          placeholder="https://example.com"
          invalid={!!errors.website}
          disabled={isLoading}
        />
        <Description>Company website URL</Description>
        {errors.website && <ErrorMessage>{errors.website}</ErrorMessage>}
      </Field>

      <Field>
        <Label>LinkedIn URL</Label>
        <Input
          type="url"
          value={formData.linkedinUrl}
          onChange={(e) =>
            setFormData({ ...formData, linkedinUrl: e.target.value })
          }
          placeholder="https://www.linkedin.com/company/example"
          invalid={!!errors.linkedinUrl}
          disabled={isLoading}
        />
        <Description>Company LinkedIn page URL</Description>
        {errors.linkedinUrl && (
          <ErrorMessage>{errors.linkedinUrl}</ErrorMessage>
        )}
      </Field>

      {errors.submit && <ErrorMessage>{errors.submit}</ErrorMessage>}

      <FormActions
        isLoading={isLoading}
        submitLabel={mode === 'create' ? 'Create Company' : 'Save Changes'}
        onCancel={handleCancel}
      />
    </form>
  );
}
