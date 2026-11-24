import { act, screen } from '@testing-library/react';
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

it('shows the organization name and advances the timeline from the SDK stream', async () => {
  render(<OrganizationSetup />);
  expect(screen.getByRole('heading', { name: 'Acme' })).toBeTruthy();
  expect(SetupStreamMock.instances[0].url).toBe('/api/organizations/1/setup');
  act(() => SetupStreamMock.instances[0].send({ status: 'running', message: 'Creating CRM objects…', step: 'crm' }));
  expect(await screen.findByText('Creating CRM objects…')).toBeTruthy();
  expect(screen.getByText('Prepare organization').textContent).toContain('Completed');
  expect(screen.getByText('Create CRM objects').textContent).toContain('In progress');
  expect(screen.getByText('Finish setup').textContent).toContain('Pending');
});

it('retains completion and the dashboard link after disconnecting', async () => {
  render(<OrganizationSetup />);
  expect(screen.queryByRole('link', { name: 'Go to dashboard' })).toBeNull();
  act(() => SetupStreamMock.instances[0].send({ status: 'ready', message: 'Your organization is ready.' }));
  expect(await screen.findByText('Setup complete')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Go to dashboard' }).getAttribute('href')).toBe('/dashboard');
  expect(SetupStreamMock.instances[0].readyState).toBe(SetupStreamMock.CLOSED);
});

it('marks the failed step without offering application retries', async () => {
  render(<OrganizationSetup />);
  act(() => SetupStreamMock.instances[0].send({ status: 'failed', message: 'Please contact your administrator.', step: 'crm' }));
  expect(await screen.findByText('Please contact your administrator.')).toBeTruthy();
  expect(screen.getByText('Prepare organization').textContent).toContain('Completed');
  expect(screen.getByText('Create CRM objects').textContent).toContain('Failed');
  expect(screen.getByText('Finish setup').textContent).toContain('Pending');
  expect(screen.queryByRole('button', { name: 'Retry setup' })).toBeNull();
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
  act(() => SetupStreamMock.instances[0].send({ status: 'running', message: 'Waiting for organization setup to start…' }));
  act(() => SetupStreamMock.instances[0].onerror?.());
  expect(screen.getByText('Waiting for organization setup to start…')).toBeTruthy();
  act(() => SetupStreamMock.instances[0].send({ status: 'ready', message: 'Your organization is ready.' }));
  expect(await screen.findByText('Setup complete')).toBeTruthy();
});
