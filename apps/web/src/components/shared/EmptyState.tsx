import type { ComponentType, ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Empty and not-found states. This is a rare, one-shot moment rather than a
 * routine interaction, so the content enters in three staged chunks — icon,
 * then copy, then the action — which reads as hierarchy instead of decoration.
 * `fill-mode-backwards` keeps each chunk hidden through its own delay.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="animate-in fade-in-0 zoom-in-95 blur-in-4 fill-mode-backwards mb-4 flex size-11 items-center justify-center rounded-full bg-zinc-100 duration-300 ease-out dark:bg-zinc-800">
          <Icon className="size-5 text-zinc-500 dark:text-zinc-400" />
        </div>
      )}
      <div className="animate-in fade-in-0 slide-in-from-bottom-2 blur-in-4 fill-mode-backwards delay-100 duration-300 ease-out">
        <p className="text-sm font-semibold text-zinc-950 dark:text-white">
          {title}
        </p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-sm text-pretty text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 blur-in-4 fill-mode-backwards mt-6 delay-200 duration-300 ease-out">
          {action}
        </div>
      )}
    </div>
  );
}
