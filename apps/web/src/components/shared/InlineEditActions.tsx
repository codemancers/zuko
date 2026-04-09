import { CheckIcon, PencilIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface InlineSaveCancelProps {
  onSave: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function InlineSaveCancel({ onSave, onCancel, disabled }: InlineSaveCancelProps) {
  return (
    <div className="ml-auto flex gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors disabled:opacity-50"
        title="Save changes"
      >
        <CheckIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
        title="Cancel"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

interface InlineEditRemoveProps {
  onEdit: () => void;
  onRemove: () => void;
  disabled?: boolean;
  editTitle?: string;
  removeTitle?: string;
}

export function InlineEditRemove({
  onEdit,
  onRemove,
  disabled,
  editTitle = 'Edit association',
  removeTitle = 'Remove',
}: InlineEditRemoveProps) {
  return (
    <div className="ml-auto flex gap-2">
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        className="text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
        title={editTitle}
      >
        <PencilIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
        title={removeTitle}
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
