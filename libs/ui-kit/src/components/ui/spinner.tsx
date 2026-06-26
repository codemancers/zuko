import { ArrowPathIcon } from '@heroicons/react/24/outline';

import { cn } from '../../lib/utils';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
    <ArrowPathIcon role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
