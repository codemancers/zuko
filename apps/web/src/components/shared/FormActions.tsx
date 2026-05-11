import { Button } from '@zuko/ui-kit';

interface FormActionsProps {
  /** Whether the form is currently submitting */
  isLoading: boolean;
  /** Label for the submit button (e.g. "Create Company", "Save Changes") */
  submitLabel: string;
  /** Label shown while loading (e.g. "Saving...", "Creating...") */
  loadingLabel?: string;
  /** Called when the cancel button is clicked */
  onCancel: () => void;
}

/**
 * Consistent form action buttons (Submit + Cancel) used across all CRM forms.
 *
 * @example
 * <FormActions
 *   isLoading={isPending}
 *   submitLabel={mode === 'create' ? 'Create Company' : 'Save Changes'}
 *   loadingLabel="Saving..."
 *   onCancel={handleCancel}
 * />
 */
export function FormActions({
  isLoading,
  submitLabel,
  loadingLabel = 'Saving...',
  onCancel,
}: FormActionsProps) {
  return (
    <div className="flex justify-end gap-3">
      <Button type="submit" disabled={isLoading}>
        {isLoading ? loadingLabel : submitLabel}
      </Button>
      <Button type="button" plain onClick={onCancel} disabled={isLoading}>
        Cancel
      </Button>
    </div>
  );
}
