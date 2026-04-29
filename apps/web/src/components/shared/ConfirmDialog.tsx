'use client';

import { Alert, AlertTitle, AlertDescription, AlertActions, Button } from '@zuko/ui-kit';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'red' | 'blue' | 'green' | 'yellow' | 'zinc';
  isLoading?: boolean;
}

/**
 * Reusable confirmation dialog component
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={handleDelete}
 *   title="Delete Task"
 *   description="Are you sure you want to delete this task? This action cannot be undone."
 *   confirmText="Delete"
 *   confirmColor="red"
 * />
 * ```
 */
export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'red',
  isLoading = false,
}: ConfirmDialogProps) => {
  return (
    <Alert open={open} onClose={onClose}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      <AlertActions>
        <Button plain onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button color={confirmColor} onClick={onConfirm} disabled={isLoading}>
          {isLoading ? 'Processing...' : confirmText}
        </Button>
      </AlertActions>
    </Alert>
  );
};

