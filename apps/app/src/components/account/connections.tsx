'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, PlugZap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, MCP_URL } from '@/lib/api';
import { describeScopes } from '@/lib/oauth-scopes';

export type Connection = {
  id: string;
  client: { id: string; name: string | null; uri: string | null };
  organization: { id: string; name: string | null } | null;
  scopes: string[];
  connected_at: string;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The applications (MCP clients) this person has approved, with a way to cut each one off.
 * Disconnecting takes effect immediately; the app has to be approved again to come back.
 */
export function Connections() {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true; // ignore a response that arrives after the page is gone
    api<{ results: Connection[] }>('/api/v1/connections')
      .then((data) => active && setConnections(data.results))
      .catch((err: Error) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, []);

  async function disconnect(id: string) {
    setBusy(id);
    setError(null);
    try {
      await api(`/api/v1/connections/${id}`, { method: 'DELETE' });
      setConnections((current) => current?.filter((c) => c.id !== id) ?? null);
      setConfirming(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (connections === null && !error) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {connections?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <PlugZap className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium">No connected apps</p>
            <p className="max-w-md text-sm text-muted-foreground">
              To connect an app such as Claude or Cursor, add this server address to it and approve the
              connection when asked:
            </p>
            <code className="rounded-md bg-muted px-2 py-1 text-xs">{MCP_URL}</code>
          </CardContent>
        </Card>
      )}

      {connections?.map((connection) => {
        const access = describeScopes(connection.scopes);
        const asking = confirming === connection.id;
        return (
          <Card key={connection.id}>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle>{connection.client.name ?? 'Unnamed application'}</CardTitle>
                <CardDescription>
                  Works in {connection.organization?.name ?? 'an organization you no longer have'} · connected{' '}
                  {formatDate(connection.connected_at)}
                </CardDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                {asking && (
                  <Button variant="outline" size="sm" disabled={busy === connection.id} onClick={() => setConfirming(null)}>
                    Keep connected
                  </Button>
                )}
                <Button
                  variant={asking ? 'destructive' : 'outline'}
                  size="sm"
                  disabled={busy === connection.id}
                  onClick={() => (asking ? disconnect(connection.id) : setConfirming(connection.id))}
                >
                  {asking ? 'Yes, disconnect' : 'Disconnect'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {asking && (
                <p className="mb-2 text-sm">
                  {connection.client.name ?? 'This application'} will stop working right away and will need your
                  approval to connect again.
                </p>
              )}
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {access.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
