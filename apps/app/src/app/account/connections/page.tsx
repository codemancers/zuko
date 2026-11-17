'use client';

import Link from 'next/link';
import { Connections } from '@/components/account/connections';
import { Shell } from '@/components/dashboard/shell';
import { UserMenu } from '@/components/dashboard/user-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

  const menu = session ? (
    <UserMenu name={session.user.name} email={session.user.email} image={session.user.image} />
  ) : (
    <Skeleton className="size-8 rounded-full" />
  );

  return (
    <Shell menu={menu}>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Connected apps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apps you have allowed to use Zuko on your behalf. They can only do what your role allows.
        </p>
      </div>
      <Connections />
    </Shell>
  );
}
