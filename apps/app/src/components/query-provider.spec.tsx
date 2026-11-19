import { render, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { auth, resetAuth } from '@/test/auth-mock';
import { authClient, useSession } from '@/lib/auth-client';
import { QueryProvider } from './query-provider';

vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);
const fetchData =
  vi.fn<(organization: string | undefined, signal: AbortSignal) => Promise<string>>();
function Probe() {
  const { data: session } = useSession();
  const { data: organization } = authClient.useActiveOrganization();
  const query = useQuery({
    queryKey: ['private-data'],
    enabled: !!session,
    queryFn: ({ signal }) => fetchData(organization?.id, signal),
  });
  return <p>{session ? (query.data ?? 'Loading') : 'Signed out'}</p>;
}
beforeEach(() => {
  resetAuth();
  auth.session = { data: { user: { id: 'user-a' } } };
  auth.activeOrg = { data: { id: 'org-a' } };
  fetchData.mockReset().mockImplementation(async (organization) => String(organization));
});

describe('query cache boundaries', () => {
  it('discards the previous organization cache before rendering the next workspace', async () => {
    const view = render(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );
    await screen.findByText('org-a');
    auth.activeOrg = { data: { id: 'org-b' } };
    view.rerender(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );
    expect(screen.queryByText('org-a')).toBeNull();
    expect(await screen.findByText('org-b')).toBeTruthy();
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it('discards cached data on sign-out and when another person signs in', async () => {
    const view = render(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );
    await screen.findByText('org-a');
    auth.session = { data: null };
    view.rerender(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );
    expect(screen.getByText('Signed out')).toBeTruthy();
    expect(screen.queryByText('org-a')).toBeNull();
    auth.session = { data: { user: { id: 'user-b' } } };
    view.rerender(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );
    await screen.findByText('org-a');
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it('aborts the old workspace request when the organization changes', async () => {
    fetchData.mockImplementation(() => new Promise(() => {}));
    const view = render(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );
    await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
    const signal = fetchData.mock.calls[0][1] as AbortSignal;
    auth.activeOrg = { data: { id: 'org-b' } };
    view.rerender(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );
    expect(signal.aborted).toBe(true);
  });
});
