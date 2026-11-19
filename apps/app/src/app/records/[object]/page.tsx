'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shell } from '@/components/dashboard/shell';
import { RecordsView } from '@/components/records/records-view';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';

export default function RecordsPage() {
  const { object } = useParams<{ object: string }>();
  const { data: session, isPending } = useSession();

  if (!isPending && !session) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <Button asChild>
          <Link href={`/login?next=/records/${object}`}>Log in</Link>
        </Button>
      </main>
    );
  }

  return (
    <Shell fill>
      {/* key: moving between objects starts a fresh list. Suspense: the view reads the URL's query. */}
      <Suspense fallback={<Skeleton className="m-6 h-64" />}>
        <RecordsView key={object} object={object} />
      </Suspense>
    </Shell>
  );
}
