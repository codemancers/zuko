import { act, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/render';
import { auth, resetAuth } from '@/test/auth-mock';
import { installSetupStreamMock, SetupStreamMock } from '@/test/setup-stream-mock';
import { OrganizationSetup } from './organization-setup';

const router = vi.hoisted(() => ({ replace: vi.fn<(path: string) => void>() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);
beforeEach(() => {
  resetAuth();
  router.replace.mockReset();
  auth.session = { data: { user: { id: '7' } }, isPending: false };
  installSetupStreamMock();
  auth.activeOrg = { data: { id: '1', name: 'Acme' }, isPending: false };
});

it('retains completion and the dashboard link after disconnecting', async () => {
  render(<OrganizationSetup />);
  expect(screen.queryByRole('link', { name: 'Go to dashboard' })).toBeNull();
  await waitFor(() => expect(SetupStreamMock.instances).toHaveLength(1));
  act(() => SetupStreamMock.instances[0].send({ status: 'ready', message: 'Your organization is ready.' }));
  expect(await screen.findByText('Setup complete')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Go to dashboard' }).getAttribute('href')).toBe('/dashboard');
  expect(SetupStreamMock.instances[0].readyState).toBe(SetupStreamMock.CLOSED);
});

it('shows loading while the active organization is being resolved', () => {
  auth.activeOrg = { data: null, isPending: true };
  render(<OrganizationSetup />);
  expect(screen.getByText('Loading organization…')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
  expect(SetupStreamMock.instances).toHaveLength(0);
});

it('sends a signed-in user with no active organization to organization creation', () => {
  auth.activeOrg = { data: null, isPending: false };
  render(<OrganizationSetup />);
  expect(router.replace).toHaveBeenCalledWith('/organizations/new');
});

it('sends a signed-out user back through login with the setup return path', () => {
  auth.session = { data: null, isPending: false };
  auth.activeOrg = { data: null, isPending: false };
  render(<OrganizationSetup />);
  expect(router.replace).toHaveBeenCalledWith('/login?next=%2Forganizations%2Fsetup');
});

it('keeps waiting for attachment when EventSource reconnects, then accepts readiness', async () => {
  render(<OrganizationSetup />);
  await waitFor(() => expect(SetupStreamMock.instances).toHaveLength(1));
  act(() => SetupStreamMock.instances[0].send({ status: 'running', message: 'Waiting for organization setup to start…' }));
  act(() => SetupStreamMock.instances[0].onerror?.());
  expect(await screen.findByText('Waiting for organization setup to start…')).toBeTruthy();
  act(() => SetupStreamMock.instances[0].send({ status: 'ready', message: 'Your organization is ready.' }));
  expect(await screen.findByText('Setup complete')).toBeTruthy();
});
