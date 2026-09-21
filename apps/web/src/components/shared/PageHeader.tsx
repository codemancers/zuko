import { Heading, Divider } from '@zuko/ui-kit';
import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * The page title block every route opens with. It owns the rhythm below the
 * heading — 8px to the description, 24px to the rule — so no page has to
 * invent its own spacing.
 *
 * Below `sm` the action stacks under the title instead of competing with it
 * for a narrow line.
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col">
          <Heading className="truncate">{title}</Heading>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-pretty text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
        {action && (
          <div className="flex shrink-0 items-center gap-3">{action}</div>
        )}
      </div>
      <Divider className="mt-6" />
    </>
  );
}
