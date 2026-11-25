import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, skipToken, useQuery } from '@tanstack/react-query';
import { organizationSetupKey, type SetupProgress } from '@/lib/organization-setup';
import { installSetupStreamMock, SetupStreamMock } from '@/test/setup-stream-mock';
import { SetupTimeline } from './setup-timeline';
import { useSetupProgress } from './use-setup-progress';

const queryKey = organizationSetupKey('1', '7');

function SetupScreen() {
  const { progress, connection } = useSetupProgress('1', '7');
  return <SetupTimeline name="Acme" progress={progress} connection={connection} />;
}

function ReadinessObserver() {
  const { data } = useQuery<SetupProgress>({ queryKey, queryFn: skipToken });
  return <p aria-label="Shared readiness">{data?.status ?? 'unknown'}</p>;
}

beforeEach(installSetupStreamMock);
afterEach(() => vi.unstubAllGlobals());

it('updates the screen and another cache observer from the same stream', async () => {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><SetupScreen /><ReadinessObserver /></QueryClientProvider>);
  await waitFor(() => expect(SetupStreamMock.instances).toHaveLength(1));
  await act(async () => {
    SetupStreamMock.instances[0].send({ status: 'running', step: 'crm', message: 'Creating CRM objects…' });
  });
  expect(await screen.findByText('Creating CRM objects…')).toBeTruthy();
  await act(async () => {
    SetupStreamMock.instances[0].send({ status: 'failed', message: 'Custom object conflict.' });
  });
  expect(await screen.findByText('Custom object conflict.')).toBeTruthy();
  expect(screen.getByText('Create CRM objects').textContent).toContain('Failed');
  expect(screen.getByLabelText('Shared readiness').textContent).toBe('failed');
});

it('keeps connection errors out of shared workflow readiness', async () => {
  const client = new QueryClient();
  const cached: SetupProgress = { status: 'running', step: 'crm', message: 'Creating CRM objects…' };
  client.setQueryData(queryKey, cached);
  render(<QueryClientProvider client={client}><SetupScreen /><ReadinessObserver /></QueryClientProvider>);
  await waitFor(() => expect(SetupStreamMock.instances).toHaveLength(1));
  act(() => {
    SetupStreamMock.instances[0].close();
    SetupStreamMock.instances[0].onerror?.();
  });
  expect(await screen.findByText('Connection closed. Please refresh to reconnect to setup progress.')).toBeTruthy();
  expect(screen.getByLabelText('Shared readiness').textContent).toBe('running');
  expect(client.getQueryData(queryKey)).toEqual(cached);
});

it('uses existing progress immediately and retains it when the screen unmounts', async () => {
  const client = new QueryClient();
  const cached: SetupProgress = { status: 'ready', message: 'Your organization is ready.' };
  client.setQueryData(queryKey, cached);
  const view = render(<QueryClientProvider client={client}><SetupScreen /></QueryClientProvider>);
  expect(screen.getByRole('link', { name: 'Go to dashboard' })).toBeTruthy();
  await waitFor(() => expect(SetupStreamMock.instances).toHaveLength(1));
  view.unmount();
  expect(SetupStreamMock.instances[0].readyState).toBe(SetupStreamMock.CLOSED);
  expect(client.getQueryData(queryKey)).toEqual(cached);
});

it('retains the latest streamed progress when a running screen unmounts', async () => {
  const client = new QueryClient();
  const cached: SetupProgress = { status: 'running', message: 'Waiting for setup…' };
  client.setQueryData(queryKey, cached);
  const view = render(<QueryClientProvider client={client}><SetupScreen /></QueryClientProvider>);
  expect(screen.getByText('Waiting for setup…')).toBeTruthy();
  await waitFor(() => expect(SetupStreamMock.instances).toHaveLength(1));
  await act(async () => {
    SetupStreamMock.instances[0].send({ status: 'running', step: 'crm', message: 'Creating CRM objects…' });
  });
  expect(await screen.findByText('Creating CRM objects…')).toBeTruthy();
  view.unmount();
  expect(SetupStreamMock.instances[0].readyState).toBe(SetupStreamMock.CLOSED);
  expect(client.getQueryData(queryKey)).toEqual({ status: 'running', step: 'crm', message: 'Creating CRM objects…' });
});
