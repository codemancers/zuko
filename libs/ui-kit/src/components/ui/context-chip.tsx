'use client';

import * as React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

export interface ContextChipProps {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'zinc';
  onRemove?: (id: string) => void;
  className?: string;
}

const colorClasses = {
  blue: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/15',
  purple:
    'bg-purple-500/15 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 hover:bg-purple-500/20 dark:hover:bg-purple-500/15',
  green:
    'bg-green-500/15 text-green-700 dark:bg-green-500/10 dark:text-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/15',
  orange:
    'bg-orange-500/15 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 hover:bg-orange-500/20 dark:hover:bg-orange-500/15',
  zinc: 'bg-zinc-500/15 text-zinc-700 dark:bg-zinc-500/10 dark:text-zinc-400 hover:bg-zinc-500/20 dark:hover:bg-zinc-500/15',
};

export const ContextChip = React.forwardRef<HTMLDivElement, ContextChipProps>(
  ({ id, label, icon, color = 'blue', onRemove, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors',
          colorClasses[color],
          className,
        )}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="truncate max-w-[200px]">{label}</span>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(id)}
            className="shrink-0 rounded-xs p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
            aria-label={`Remove ${label}`}
          >
            <XMarkIcon className="size-3" />
          </button>
        )}
      </div>
    );
  },
);

ContextChip.displayName = 'ContextChip';
