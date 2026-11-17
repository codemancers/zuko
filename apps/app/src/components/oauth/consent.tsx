'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient, useSession } from '@/lib/auth-client';
import { SCOPE_LABELS } from '@/lib/oauth-scopes';

// The shape /oauth2/public-client returns: OIDC client metadata, so snake_case.
type PublicClient = { client_id: string; client_name?: string };
type Decision = { redirect?: boolean; url?: string };

const defaultNavigate = (url: string) => window.location.assign(url);

// The query string only exists in the browser. null while rendering on the server keeps
// hydration consistent, and the URL does not change while this page is shown.
const subscribeNever = () => () => undefined;
const readSearch = () => window.location.search;
const serverSearch = () => null;

/**
 * The page an MCP client sends people to after they sign in, to approve the connection.
 *
 * The URL carries the client's signed authorization request; the OAuth client plugin
 * attaches it to the consent call, so this page never handles it. The connection is
 * bound to the organization that is active now, which is why it is named here.
 */
export function Consent({ navigate = defaultNavigate }: { navigate?: (url: string) => void }) {
  const { data: session, isPending } = useSession();
  const { data: organization } = authClient.useActiveOrganization();
  const [client, setClient] = useState<PublicClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = useSyncExternalStore(subscribeNever, readSearch, serverSearch);

  const params = new URLSearchParams(search ?? '');
  const clientId = params.get('client_id');
  const scopes = (params.get('scope') ?? '').split(' ').filter(Boolean);
  const valid = Boolean(clientId && params.get('sig') && scopes.length > 0);

  useEffect(() => {
    if (!session || !valid || !clientId) return;
    authClient
      .$fetch<PublicClient>('/oauth2/public-client', { query: { client_id: clientId } })
      .then(({ data, error: err }) => {
        if (data) setClient(data);
        else setError(err?.message ?? 'This application is not recognised.');
      });
  }, [session, valid, clientId]);

  if (isPending || search === null) return <Skeleton className="h-64 w-full" />;

  if (!valid) {
    return (
      <Card>
        <CardHeader>
          <h1 className="font-heading text-xl font-medium">This link is not valid</h1>
          <CardDescription>Start the connection again from the app you are connecting.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card>
        <CardHeader>
          <h1 className="font-heading text-xl font-medium">Log in to continue</h1>
          <CardDescription>You need to be logged in to approve this connection.</CardDescription>
        </CardHeader>
        <CardFooter>
          {/* The signed request travels with the link, so signing in resumes this flow. */}
          <Button asChild className="w-full">
            <Link href={`/login${search}`}>Log in</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  async function decide(accept: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = await authClient.$fetch<Decision>('/oauth2/consent', {
      method: 'POST',
      body: { accept },
    });
    if (data?.url) {
      navigate(data.url);
      return;
    }
    setError(err?.message ?? 'Something went wrong. Please try again.');
    setBusy(false);
  }

  const name = client?.client_name || 'An application';

  return (
    <Card>
      <CardHeader className="text-center">
        <h1 className="font-heading text-xl font-medium">Connect {name}</h1>
        <CardDescription>
          {name} wants to access Zuko on your behalf.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {organization ? (
          <p className="text-sm">
            It will work in <strong>{organization.name}</strong>. To use a different organization,
            cancel, switch organization in Zuko, and connect again.
          </p>
        ) : (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>
              You need an organization first.{' '}
              <Link href="/organizations/new" className="underline">
                Create one
              </Link>
              , then connect again.
            </AlertDescription>
          </Alert>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">This will let it:</p>
          <ul className="flex flex-col gap-2 text-sm">
            {scopes.map((scope) => (
              <li key={scope} className="flex items-start gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {SCOPE_LABELS[scope] ?? scope}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          It can only do what your role in the organization allows.
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={busy || !organization} onClick={() => decide(true)}>
          Allow
        </Button>
      </CardFooter>
    </Card>
  );
}
