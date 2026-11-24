'use client';

import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { Shell } from '@/components/dashboard/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DetailsList, DetailField } from '@/components/ui/details';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';

export default function ProfilePage() {
  const { data: session, isPending } = useSession();
  if (isPending)
    return (
      <Shell fill>
        <div className="p-4 sm:p-6">
          <Skeleton className="h-64" />
        </div>
      </Shell>
    );
  if (!session)
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Button asChild>
          <Link href="/login?next=/account/profile">Log in</Link>
        </Button>
      </main>
    );
  const user = session.user;
  return (
    <Shell fill>
      <div className="flex shrink-0 items-center gap-3 border-b px-4 pt-6 pb-5 sm:px-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-card shadow-xs">
          <UserRound className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Account</p>
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Profile</h1>
        </div>
      </div>
      <div className="min-h-0 overflow-auto p-4 sm:p-6">
        <DetailsList>
          <DetailField label="Name">{user.name}</DetailField>
          <DetailField label="Email">{user.email}</DetailField>
          <DetailField label="Email status">
            <Badge variant="secondary">{user.emailVerified ? 'Verified' : 'Unverified'}</Badge>
          </DetailField>
          <DetailField label="Member since">
            {new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
          </DetailField>
        </DetailsList>
      </div>
    </Shell>
  );
}
