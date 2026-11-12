import Link from 'next/link';

// The Zuko mark: an amber Z on a warm circle that follows the theme.
function ZukoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="46" className="fill-[#f5f4f1] dark:fill-[#292524]" />
      <path
        d="M 34 36 L 66 36 L 66 42 L 42 60 L 66 60 L 66 66 L 34 66 L 34 60 L 58 42 L 34 42 Z"
        fill="#f59e0b"
      />
    </svg>
  );
}

export function Brand({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Zuko"
      className="flex items-center gap-2 font-heading text-lg font-semibold"
    >
      <ZukoMark className="size-8" />
      {!iconOnly && 'Zuko'}
    </Link>
  );
}
