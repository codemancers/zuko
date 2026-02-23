"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { accountsApi, type SalesAccount, type CreateAccountDto, type UpdateAccountDto } from "@/lib/api/accounts";
import { Button, Input, Field, Label, Textarea, Description, ErrorMessage } from "@zuko/ui-kit";
import { useRouter } from "next/navigation";

interface AccountFormProps {
  account?: SalesAccount;
  mode: "create" | "edit";
  currentUserId: number;
}

export default function AccountForm({ account, mode, currentUserId }: AccountFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    companyName: account?.companyName || "",
    website: account?.website || "",
    linkedinUrl: account?.linkedinUrl || "",
    summary: account?.summary || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateAccountDto) => accountsApi.createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      router.push("/accounts");
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || "Failed to create account" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateAccountDto) => accountsApi.updateAccount(account!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account", account!.id] });
      router.push(`/accounts/${account!.id}`);
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || "Failed to update account" });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = "Company name is required";
    }

    // Validate website URL if provided
    if (formData.website) {
      try {
        const url = new URL(formData.website);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          newErrors.website = "Website must be a valid URL (e.g., https://example.com)";
        }
      } catch {
        newErrors.website = "Website must be a valid URL (e.g., https://example.com)";
      }
    }

    // Validate LinkedIn URL if provided
    if (formData.linkedinUrl) {
      try {
        const url = new URL(formData.linkedinUrl);
        if (!url.hostname.includes('linkedin.com')) {
          newErrors.linkedinUrl = "LinkedIn URL must be from linkedin.com";
        }
      } catch {
        newErrors.linkedinUrl = "LinkedIn URL must be a valid URL (e.g., https://www.linkedin.com/company/example)";
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

    if (mode === "create") {
      createMutation.mutate({
        ...formData,
        website: formData.website || undefined,
        linkedinUrl: formData.linkedinUrl || undefined,
        summary: formData.summary || undefined,
        ownerIds: [currentUserId],
        primaryOwnerId: currentUserId,
      });
    } else {
      updateMutation.mutate({
        ...formData,
        website: formData.website || undefined,
        linkedinUrl: formData.linkedinUrl || undefined,
        summary: formData.summary || undefined,
      });
    }
  };

  const handleCancel = () => {
    if (mode === "edit" && account) {
      router.push(`/accounts/${account.id}`);
    } else {
      router.push("/accounts");
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Company Name */}
      <Field>
        <Label>Company Name *</Label>
        <Input
          type="text"
          value={formData.companyName}
          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
          placeholder="Acme Inc."
          invalid={!!errors.companyName}
          disabled={isLoading}
        />
        {errors.companyName && <ErrorMessage>{errors.companyName}</ErrorMessage>}
      </Field>

      {/* Website */}
      <Field>
        <Label>Website</Label>
        <Input
          type="url"
          value={formData.website}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          placeholder="https://example.com"
          invalid={!!errors.website}
          disabled={isLoading}
        />
        <Description>Company website URL</Description>
        {errors.website && <ErrorMessage>{errors.website}</ErrorMessage>}
      </Field>

      {/* LinkedIn URL */}
      <Field>
        <Label>LinkedIn URL</Label>
        <Input
          type="url"
          value={formData.linkedinUrl}
          onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
          placeholder="https://www.linkedin.com/company/example"
          invalid={!!errors.linkedinUrl}
          disabled={isLoading}
        />
        <Description>Company LinkedIn page URL</Description>
        {errors.linkedinUrl && <ErrorMessage>{errors.linkedinUrl}</ErrorMessage>}
      </Field>

      {/* Summary */}
      <Field>
        <Label>Summary</Label>
        <Textarea
          value={formData.summary}
          onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
          placeholder="Add a summary about this account..."
          rows={6}
          disabled={isLoading}
        />
        <Description>Free-form notes about this account</Description>
      </Field>

      {/* Submit Error */}
      {errors.submit && (
        <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">{errors.submit}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : mode === "create" ? "Create Account" : "Save Changes"}
        </Button>
        <Button type="button" plain onClick={handleCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
