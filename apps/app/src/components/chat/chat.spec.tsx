import { fireEvent, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { render } from '@/test/render';
import { auth, resetAuth } from '@/test/auth-mock';
import { organizationSetupKey } from '@/lib/organization-setup';
import { Chat } from './chat';

const mocks = vi.hoisted(() => ({ agent: vi.fn<() => unknown>() }));
vi.mock('next/navigation', async () => (await import('@/test/navigation-mock')).navigationModule);
vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);
vi.mock('eve/react', () => ({ useEveAgent: mocks.agent }));
vi.mock('eve/events', () => ({ activeTurn: () => null, activity: () => ({ kind: 'idle' }) }));
vi.mock('@/components/dashboard/shell', () => ({
  Shell: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  resetAuth();
  mocks.agent.mockReset();
  auth.session = { data: { user: { id: '7' } }, isPending: false };
  auth.activeOrg = { data: { id: '11', name: 'Acme' }, isPending: false };
  mocks.agent.mockReturnValue({ messages: [], status: 'idle', view: null });
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'running', message: 'Preparing organization…' })));
});

function CompleteSetup() {
  const client = useQueryClient();
  return <button onClick={() => client.setQueryData(organizationSetupKey('11', '7'), { status: 'ready', message: 'Ready' })}>Complete setup</button>;
}

it('does not initialize or resume Eve until the cached organization readiness becomes ready', async () => {
  render(<><Chat sessionId="existing-chat" /><CompleteSetup /></>);
  expect(await screen.findByText('Chat will be available when organization setup is complete.')).toBeTruthy();
  expect(mocks.agent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Complete setup' }));
  expect(await screen.findByText('Zuko copilot')).toBeTruthy();
  expect(mocks.agent).toHaveBeenCalledWith(expect.objectContaining({
    initialSession: { sessionId: 'existing-chat', streamIndex: 0 },
    resume: true,
  }));
  expect(fetch).toHaveBeenCalledTimes(1);
});
