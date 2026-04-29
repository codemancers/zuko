'use client';

import clsx from 'clsx';
import {
  Button,
  Link,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@zuko/ui-kit';
import {
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import React from 'react';

// ---------------------------------------------------------------------------
// Base icon button — shared style for all table action buttons
// ---------------------------------------------------------------------------

interface TableActionButtonProps {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'success';
  className?: string;
  children: React.ReactNode;
}

export function TableActionButton({
  onClick,
  label,
  disabled,
  variant = 'default',
  className,
  children,
}: TableActionButtonProps) {
  const colorClass =
    variant === 'danger'
      ? '!text-zinc-400 data-hover:!text-red-600 dark:data-hover:!text-red-400 data-[hover]:!bg-red-500/15 dark:data-[hover]:!bg-red-500/20'
      : variant === 'success'
        ? '!text-zinc-400 data-hover:!text-green-600 dark:data-hover:!text-green-400 data-[hover]:!bg-green-500/15 dark:data-[hover]:!bg-green-500/20'
        : '!text-zinc-400 data-hover:!text-zinc-600 dark:data-hover:!text-zinc-200';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          plain
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={clsx('group rounded p-1.5', colorClass, className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// View — navigates to href
// ---------------------------------------------------------------------------

interface ViewActionProps {
  href: string;
  label?: string;
}

function ViewAction({ href, label = 'View' }: ViewActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={label}
          className="rounded p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          <EyeIcon className="h-4 w-4" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

interface EditActionProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}

function EditAction({ onClick, label = 'Edit', disabled }: EditActionProps) {
  return (
    <TableActionButton onClick={onClick} label={label} disabled={disabled}>
      <PencilSquareIcon className="h-4 w-4" />
    </TableActionButton>
  );
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

interface DeleteActionProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}

export function DeleteAction({ onClick, label = 'Delete', disabled }: DeleteActionProps) {
  return (
    <TableActionButton onClick={onClick} label={label} disabled={disabled} variant="danger">
      <TrashIcon className="h-4 w-4" />
    </TableActionButton>
  );
}

// ---------------------------------------------------------------------------
// TableActions container — wraps action buttons with stopPropagation + TooltipProvider
// ---------------------------------------------------------------------------

interface TableActionsProps {
  children: React.ReactNode;
}

export function TableActions({ children }: TableActionsProps) {
  return (
    <TooltipProvider>
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </TooltipProvider>
  );
}
