'use client';

import Link from 'next/link';
import { PlugZap } from 'lucide-react';
import { Connections } from '@/components/account/connections';
import { Shell } from '@/components/dashboard/shell';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';

export default function ConnectionsPage() {
  const { data: session, isPending } = useSession();

  if (!isPending && !session) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <Button asChild>
          <Link href="/login?next=/account/connections">Log in</Link>
        </Button>
      </main>
    );
  }

  return (
    <Shell fill>
      <div className="flex shrink-0 items-center gap-3 px-4 py-5 sm:px-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-card shadow-xs">
          <PlugZap className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Connected apps</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Apps you have allowed to use Zuko on your behalf. They can only do what your role
            allows.
          </p>
        </div>
      </div>
      <Connections />
    </Shell>
  );
}
