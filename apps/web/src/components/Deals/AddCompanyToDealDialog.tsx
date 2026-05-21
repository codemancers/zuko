'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '@/lib/api/deals';
import { getCompanies } from '@/server/query-options';
import {
  Button,
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
  Field,
  Label,
  Description,
  ErrorMessage,
  Select,
  Switch,
  Text,
} from '@zuko/ui-kit';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

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
      await queryClient.invalidateQueries({
        queryKey: ['timeline', 'deal', dealId],
      });
      toast.success('Company added to deal');
      setIsOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add company to deal');
      setErrors({ submit: error.message || 'Failed to add company to deal' });
    },
  });

  const resetForm = () => {
    setSelectedCompanyId(null);
    setIsPrimary(false);
    setErrors({});
  };

  const handleClose = () => {
    setIsOpen(false);
    resetForm();
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

      <Sheet open={isOpen} onClose={handleClose} side="right">
        <SheetHeader>
          <SheetTitle>Add Company to Deal</SheetTitle>
          <Button plain onClick={handleClose}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <SheetBody>
            <div className="space-y-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Associate a company with this deal.
              </p>
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

              <Field>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isPrimary}
                    onChange={setIsPrimary}
                    color="blue"
                    disabled={addCompanyMutation.isPending}
                  />
                  <Text>Primary company for this deal</Text>
                </div>
                <Description>
                  Mark as the main company for this deal
                </Description>
              </Field>

              {errors.submit && <ErrorMessage>{errors.submit}</ErrorMessage>}
            </div>
          </SheetBody>

          <SheetFooter>
            <Button
              type="submit"
              disabled={
                addCompanyMutation.isPending || availableCompanies.length === 0
              }
            >
              {addCompanyMutation.isPending ? 'Adding...' : 'Add Company'}
            </Button>
            <Button plain onClick={handleClose}>
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </Sheet>
    </>
  );
}
