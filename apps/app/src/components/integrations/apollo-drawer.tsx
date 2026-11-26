'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { permissionsQuery } from '@/lib/queries';

export interface ApolloStatus {
  provider: 'apollo';
  connected: boolean;
  account: string | null;
  connected_at: string | null;
}

export const apolloStatusQuery = {
  queryKey: ['integrations', 'apollo'],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    api<ApolloStatus>('/api/v1/integrations/apollo', { signal }),
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Connect, replace or remove the organization's Apollo key. An Apollo key acts as the Apollo workspace, not as
 * one person, so a single key is shared: admins connect it, and everyone who may enrich records uses it. The key
 * goes to the connections service (Kosha) and is never shown again.
 */
export function ApolloDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const status = useQuery(apolloStatusQuery);
  const permissions = useQuery(permissionsQuery);
  const canManage = permissions.data?.can_manage_integrations === true;
  const [apiKey, setApiKey] = useState('');
  const [confirming, setConfirming] = useState(false);

  const reset = () => {
    setApiKey('');
    setConfirming(false);
    connect.reset();
    disconnect.reset();
  };
  const close = () => {
    reset();
    onClose();
  };

  const connect = useMutation({
    mutationFn: (key: string) =>
      api<ApolloStatus>('/api/v1/integrations/apollo', { method: 'PUT', json: { api_key: key } }),
    onSuccess: (next) => {
      client.setQueryData(apolloStatusQuery.queryKey, next);
      setApiKey('');
    },
  });
  const disconnect = useMutation({
    mutationFn: () => api('/api/v1/integrations/apollo', { method: 'DELETE' }),
    onSuccess: () => {
      client.setQueryData<ApolloStatus>(apolloStatusQuery.queryKey, {
        provider: 'apollo',
        connected: false,
        account: null,
        connected_at: null,
      });
      setConfirming(false);
    },
  });

  const connected = status.data?.connected === true;
  const error = status.error?.message ?? connect.error?.message ?? disconnect.error?.message;
  const busy = connect.isPending || disconnect.isPending;

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && !busy && close()}>
      <DrawerContent>
        <DrawerHeader>
          <p className="text-xs font-medium text-muted-foreground">Integration</p>
          <DrawerTitle>Apollo</DrawerTitle>
          <DrawerDescription>
            Look up contacts, prospects, leads and companies in Apollo and fill in their empty fields, from the
            record or by asking the assistant. Apollo charges credits for each lookup.
          </DrawerDescription>
        </DrawerHeader>
        {error && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DrawerBody>
          {status.isPending ? (
            <p className="text-sm text-muted-foreground">Checking the connection…</p>
          ) : (
            <form
              id="apollo-form"
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (apiKey.trim()) connect.mutate(apiKey.trim());
              }}
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                {connected ? (
                  <>
                    <CheckCircle2 className="size-4 text-green-600" aria-hidden />
                    Connected
                    {status.data?.account ? (
                      <span className="font-normal text-muted-foreground">as {status.data.account}</span>
                    ) : null}
                  </>
                ) : (
                  'Not connected'
                )}
              </p>
              {connected && status.data?.connected_at && (
                <p className="text-xs text-muted-foreground">Since {formatDate(status.data.connected_at)}</p>
              )}
              {canManage ? (
                <div className="space-y-1.5">
                  <Label htmlFor="apollo-key">{connected ? 'Replace the API key' : 'Apollo API key'}</Label>
                  <Input
                    id="apollo-key"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    placeholder="Paste a key from Apollo → Settings → Integrations → API Keys"
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The key acts as your whole Apollo workspace. If your plan lets you pick endpoints, allow
                    people match, organization enrichment and <code>GET /users/api_profile</code>.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {connected ? 'An owner or admin manages this connection.' : 'Ask an owner or admin to connect Apollo.'}
                </p>
              )}
              {confirming && (
                <p className="text-xs text-muted-foreground">Enrichment stops working until a key is connected again.</p>
              )}
            </form>
          )}
        </DrawerBody>
        <DrawerFooter>
          {canManage && connected && (
            <div className="mr-auto flex gap-2">
              {confirming ? (
                <>
                  <Button variant="destructive" disabled={busy} onClick={() => disconnect.mutate()}>
                    Yes, disconnect
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
                    Keep connected
                  </Button>
                </>
              ) : (
                <Button variant="destructive" disabled={busy} onClick={() => setConfirming(true)}>
                  Disconnect
                </Button>
              )}
            </div>
          )}
          <Button variant="outline" disabled={busy} onClick={close}>
            Close
          </Button>
          {canManage && (
            <Button type="submit" form="apollo-form" disabled={busy || !apiKey.trim()}>
              {connect.isPending && (
                <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {connected ? 'Replace key' : 'Connect'}
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
