"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dealsApi } from "@/lib/api/deals";
import { getAccounts } from "@/server/query-options";
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
} from "@zuko/ui-kit";
import { PlusIcon } from "@heroicons/react/24/outline";

interface AddAccountToDealDialogProps {
  dealId: number;
  existingAccountIds: number[];
}

export default function AddAccountToDealDialog({ dealId, existingAccountIds }: AddAccountToDealDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();
  const { data: accountsData } = useQuery(getAccounts({}));

  // Filter out accounts that are already associated with this deal
  const availableAccounts = accountsData?.accounts.filter(
    (account) => !existingAccountIds.includes(account.id)
  ) || [];

  const addAccountMutation = useMutation({
    mutationFn: () => {
      if (!selectedAccountId) {
        throw new Error("No account selected");
      }
      return dealsApi.addAccount(dealId, {
        accountId: selectedAccountId,
        isPrimary,
      });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["deal", dealId] });
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
      setIsOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || "Failed to add account to deal" });
    },
  });

  const resetForm = () => {
    setSelectedAccountId(null);
    setIsPrimary(false);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!selectedAccountId) {
      newErrors.account = "Please select an account";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    addAccountMutation.mutate();
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        Add Account
      </Button>

      <Dialog open={isOpen} onClose={() => { setIsOpen(false); resetForm(); }}>
        <DialogTitle>Add Account to Deal</DialogTitle>
        <DialogDescription>
          Associate an account (company) with this deal.
        </DialogDescription>

        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="space-y-4">
              {/* Account Selection */}
              <Field>
                <Label>Account *</Label>
                <select
                  value={selectedAccountId || ""}
                  onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  disabled={addAccountMutation.isPending}
                >
                  <option value="">Select an account...</option>
                  {availableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.companyName}
                    </option>
                  ))}
                </select>
                {availableAccounts.length === 0 && (
                  <Description className="text-amber-600">
                    All accounts are already associated with this deal.
                  </Description>
                )}
                {errors.account && <ErrorMessage>{errors.account}</ErrorMessage>}
              </Field>

              {/* Primary Flag */}
              <Field>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700"
                    disabled={addAccountMutation.isPending}
                  />
                  <span className="text-sm text-zinc-950 dark:text-white">
                    Primary account for this deal
                  </span>
                </label>
                <Description>Mark as the main company for this deal</Description>
              </Field>

              {/* Submit Error */}
              {errors.submit && (
                <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
                  <p className="text-sm text-red-800 dark:text-red-200">{errors.submit}</p>
                </div>
              )}
            </div>
          </DialogBody>

          <DialogActions>
            <Button plain onClick={() => { setIsOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addAccountMutation.isPending || availableAccounts.length === 0}
            >
              {addAccountMutation.isPending ? "Adding..." : "Add Account"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
