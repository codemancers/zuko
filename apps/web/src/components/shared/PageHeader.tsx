import { Heading, Divider } from '@zuko/ui-kit';
import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <Heading>{title}</Heading>
          {description && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <Divider className="mt-6" />
    </>
  );
}
