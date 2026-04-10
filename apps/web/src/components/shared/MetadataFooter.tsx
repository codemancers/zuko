import dayjs from 'dayjs';
import { Subheading } from '@zuko/ui-kit';

interface MetadataFooterProps {
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Consistent "Details" metadata section showing Created/Last Updated timestamps.
 * Used at the bottom of CRM detail pages.
 *
 * @example
 * <MetadataFooter createdAt={entity.createdAt} updatedAt={entity.updatedAt} />
 */
export function MetadataFooter({ createdAt, updatedAt }: MetadataFooterProps) {
  return (
    <div className="mt-8">
      <Subheading>Details</Subheading>
      <dl className="mt-4 space-y-4">
        <div className="grid grid-cols-3">
          <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Created
          </dt>
          <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
            {dayjs(createdAt).format('MMMM D, YYYY [at] h:mm A')}
          </dd>
        </div>
        <div className="grid grid-cols-3">
          <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Last Updated
          </dt>
          <dd className="col-span-2 text-sm text-zinc-950 dark:text-white">
            {dayjs(updatedAt).format('MMMM D, YYYY [at] h:mm A')}
          </dd>
        </div>
      </dl>
    </div>
  );
}
