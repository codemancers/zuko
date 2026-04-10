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
      <dl className="mt-4 flex flex-wrap gap-x-24 gap-y-4">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            Created
          </dt>
          <dd className="text-sm text-zinc-950 dark:text-white">
            {dayjs(createdAt).format('MMMM D, YYYY [at] h:mm A')}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            Last Updated
          </dt>
          <dd className="text-sm text-zinc-950 dark:text-white">
            {dayjs(updatedAt).format('MMMM D, YYYY [at] h:mm A')}
          </dd>
        </div>
      </dl>
    </div>
  );
}
