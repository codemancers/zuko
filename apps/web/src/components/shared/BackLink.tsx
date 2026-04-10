import Link from 'next/link';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

interface BackLinkProps {
  href: string;
  children: React.ReactNode;
}

/**
 * Consistent back-navigation link used at the top of detail pages.
 *
 * @example
 * <BackLink href="/companies">Companies</BackLink>
 */
export function BackLink({ href, children }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400"
    >
      <ChevronLeftIcon className="size-4" />
      {children}
    </Link>
  );
}
