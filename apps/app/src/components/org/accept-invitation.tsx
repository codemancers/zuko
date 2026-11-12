'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient, useSession } from '@/lib/auth-client';

type Invitation = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.getInvitation>>['data']
>;

export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    authClient.organization.getInvitation({ query: { id: invitationId } }).then(({ data, error: err }) => {
      if (data) setInvitation(data);
      else setError(err?.message ?? 'This invitation is not valid.');
    });
  }, [session, invitationId]);

  if (isPending) return <Skeleton className="h-48 w-full" />;

  if (!session) {
    const next = encodeURIComponent(`/accept-invitation/${invitationId}`);
    return (
      <Card>
        <CardHeader>
          <h1 className="font-heading text-xl font-medium">You have been invited</h1>
          <CardDescription>Log in or sign up with the invited email to join.</CardDescription>
        </CardHeader>
        <CardFooter className="gap-2">
          <Button asChild className="flex-1">
            <Link href={`/login?next=${next}`}>Log in</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/signup?next=${next}`}>Sign up</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  async function respond(accept: boolean) {
    setBusy(true);
    setError(null);
    const { error: err } = accept
      ? await authClient.organization.acceptInvitation({ invitationId })
      : await authClient.organization.rejectInvitation({ invitationId });
    if (err) {
      setError(err.message ?? 'Something went wrong.');
      setBusy(false);
      return;
    }
    router.push('/dashboard');
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="font-heading text-xl font-medium">
          {invitation ? `Join ${invitation.organizationName}` : 'Invitation'}
        </h1>
        <CardDescription>
          {invitation
            ? `${invitation.inviterEmail} invited you as ${invitation.role}.`
            : 'Checking your invitation…'}
        </CardDescription>
      </CardHeader>
      {error && (
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      )}
      <CardFooter className="gap-2">
        <Button className="flex-1" disabled={!invitation || busy} onClick={() => respond(true)}>
          Accept
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={!invitation || busy}
          onClick={() => respond(false)}
        >
          Decline
        </Button>
      </CardFooter>
    </Card>
  );
}
