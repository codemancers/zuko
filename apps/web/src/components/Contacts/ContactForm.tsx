'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  contactsApi,
  type Contact,
  type CreateContactDto,
  type UpdateContactDto,
} from '@/lib/api/contacts';
import {
  Button,
  Input,
  Field,
  Label,
  Textarea,
  Description,
  ErrorMessage,
} from '@zuko/ui-kit';
import { useRouter } from 'next/navigation';

interface ContactFormProps {
  contact?: Contact;
  mode: 'create' | 'edit';
  currentUserId: number;
}

export default function ContactForm({
  contact,
  mode,
  currentUserId,
}: ContactFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: contact?.name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    linkedinId: contact?.linkedinId || '',
    notes: contact?.notes || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateContactDto) => contactsApi.createContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      router.push('/contacts');
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || 'Failed to create contact' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateContactDto) =>
      contactsApi.updateContact(contact!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', contact!.id] });
      router.push(`/contacts/${contact!.id}`);
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || 'Failed to update contact' });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email && !formData.phone && !formData.linkedinId) {
      newErrors.contactMethod =
        'At least one contact method (email, phone, or LinkedIn) is required';
    }

    if (formData.phone && !formData.phone.match(/^\+[1-9]\d{1,14}$/)) {
      newErrors.phone = 'Phone must be in E.164 format (e.g., +14155552671)';
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
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        linkedinId: formData.linkedinId || undefined,
        notes: formData.notes || undefined,
        ownerIds: [currentUserId],
        primaryOwnerId: currentUserId,
      });
    } else {
      updateMutation.mutate({
        ...formData,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        linkedinId: formData.linkedinId || undefined,
        notes: formData.notes || undefined,
      });
    }
  };

  const handleCancel = () => {
    if (mode === 'edit' && contact) {
      router.push(`/contacts/${contact.id}`);
    } else {
      router.push('/contacts');
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <Field>
        <Label>Name *</Label>
        <Input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="John Doe"
          invalid={!!errors.name}
          disabled={isLoading}
        />
        {errors.name && <ErrorMessage>{errors.name}</ErrorMessage>}
      </Field>

      {/* Email */}
      <Field>
        <Label>Email</Label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="john@example.com"
          disabled={isLoading}
        />
      </Field>

      {/* Phone */}
      <Field>
        <Label>Phone</Label>
        <Input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="+14155552671"
          invalid={!!errors.phone}
          disabled={isLoading}
        />
        <Description>E.164 format (e.g., +14155552671)</Description>
        {errors.phone && <ErrorMessage>{errors.phone}</ErrorMessage>}
      </Field>

      {/* LinkedIn ID */}
      <Field>
        <Label>LinkedIn ID</Label>
        <Input
          type="text"
          value={formData.linkedinId}
          onChange={(e) =>
            setFormData({ ...formData, linkedinId: e.target.value })
          }
          placeholder="john-doe-123456"
          disabled={isLoading}
        />
        <Description>LinkedIn profile identifier</Description>
      </Field>

      {/* Contact Method Error */}
      {errors.contactMethod && (
        <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">
            {errors.contactMethod}
          </p>
        </div>
      )}

      {/* Notes */}
      <Field>
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Add notes about this contact..."
          rows={6}
          disabled={isLoading}
        />
        <Description>Free-form notes about this contact</Description>
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
              ? 'Create Contact'
              : 'Save Changes'}
        </Button>
        <Button type="button" plain onClick={handleCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
