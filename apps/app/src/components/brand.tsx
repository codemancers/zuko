import Link from 'next/link';
import { Flame } from 'lucide-react';

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-heading text-lg font-semibold">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Flame className="size-4" aria-hidden />
      </span>
      Zuko
    </Link>
  );
}
