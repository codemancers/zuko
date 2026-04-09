'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '@/lib/api/deals';
import { getCompanies } from '@/server/query-options';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
  Field,
  Label,
  Description,
  ErrorMessage,
  Select,
} from '@zuko/ui-kit';
import { PlusIcon } from '@heroicons/react/24/outline';

interface AddCompanyToDealDialogProps {
  dealId: number;
  existingCompanyIds: number[];
}

export default function AddCompanyToDealDialog({
  dealId,
  existingCompanyIds,
}: AddCompanyToDealDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    null,
  );
  const [isPrimary, setIsPrimary] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();
  const { data: companiesData } = useQuery(getCompanies({}));

  // Filter out companies that are already associated with this deal
  const availableCompanies =
    companiesData?.companies.filter(
      (company) => !existingCompanyIds.includes(company.id),
    ) || [];

  const addCompanyMutation = useMutation({
    mutationFn: () => {
      if (!selectedCompanyId) {
        throw new Error('No company selected');
      }
      return dealsApi.addCompany(dealId, {
        companyId: selectedCompanyId,
        isPrimary,
      });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['deal', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['deals'] });
      await queryClient.invalidateQueries({ queryKey: ['timeline', 'deal', dealId] });
      setIsOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || 'Failed to add company to deal' });
    },
  });

  const resetForm = () => {
    setSelectedCompanyId(null);
    setIsPrimary(false);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!selectedCompanyId) {
      newErrors.company = 'Please select a company';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    addCompanyMutation.mutate();
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        Add Company
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => {
          setIsOpen(false);
          resetForm();
        }}
      >
        <DialogTitle>Add Company to Deal</DialogTitle>
        <DialogDescription>
          Associate a company with this deal.
        </DialogDescription>

        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="space-y-4">
              {/* Company Selection */}
              <Field>
                <Label>Company *</Label>
                <Select
                  value={selectedCompanyId || ''}
                  onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                  disabled={addCompanyMutation.isPending}
                >
                  <option value="">Select a company...</option>
                  {availableCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.companyName}
                    </option>
                  ))}
                </Select>
                {availableCompanies.length === 0 && (
                  <Description className="text-amber-600">
                    All companies are already associated with this deal.
                  </Description>
                )}
                {errors.company && (
                  <ErrorMessage>{errors.company}</ErrorMessage>
                )}
              </Field>

              {/* Primary Flag */}
              <Field>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700"
                    disabled={addCompanyMutation.isPending}
                  />
                  <span className="text-sm text-zinc-950 dark:text-white">
                    Primary company for this deal
                  </span>
                </label>
                <Description>
                  Mark as the main company for this deal
                </Description>
              </Field>

              {/* Submit Error */}
              {errors.submit && <ErrorMessage>{errors.submit}</ErrorMessage>}
            </div>
          </DialogBody>

          <DialogActions>
            <Button
              plain
              onClick={() => {
                setIsOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                addCompanyMutation.isPending || availableCompanies.length === 0
              }
            >
              {addCompanyMutation.isPending ? 'Adding...' : 'Add Company'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
