import { render, screen } from '@testing-library/react';
import { SetupTimeline } from './setup-timeline';

it('shows the organization and each step’s progress', () => {
  render(<SetupTimeline name="Acme" progress={{ status: 'running', step: 'crm', message: 'Creating CRM objects…' }} />);
  expect(screen.getByRole('heading', { name: 'Acme' })).toBeTruthy();
  expect(screen.getByText('Prepare organization').textContent).toContain('Completed');
  expect(screen.getByText('Create CRM objects').textContent).toContain('In progress');
  expect(screen.getByText('Finish setup').textContent).toContain('Pending');
  expect(screen.queryByRole('link', { name: 'Go to dashboard' })).toBeNull();
});

it('offers dashboard navigation once setup is complete', () => {
  render(<SetupTimeline name="Acme" progress={{ status: 'ready', message: 'Your organization is ready.' }} />);
  expect(screen.getByText('Setup complete')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Go to dashboard' }).getAttribute('href')).toBe('/dashboard');
});

it('shows the failed step and the server’s explanation', () => {
  render(<SetupTimeline name="Acme" progress={{ status: 'failed', step: 'crm', message: 'Custom object conflict.' }} />);
  expect(screen.getByText('Prepare organization').textContent).toContain('Completed');
  expect(screen.getByText('Create CRM objects').textContent).toContain('Failed');
  expect(screen.getByText('Finish setup').textContent).toContain('Pending');
  expect(screen.getByText('Custom object conflict.')).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Go to dashboard' })).toBeNull();
});

it('keeps the waiting message while reconnecting before any step starts', () => {
  render(<SetupTimeline name="Acme" progress={{ status: 'running', message: 'Waiting for organization setup to start…' }} connection="reconnecting" />);
  expect(screen.getByText('Waiting for organization setup to start…')).toBeTruthy();
});

it('shows connection trouble without marking the active step as failed', () => {
  const progress = { status: 'running', step: 'crm', message: 'Creating CRM objects…' } as const;
  const view = render(<SetupTimeline name="Acme" progress={progress} connection="reconnecting" />);
  expect(screen.getByText('Connection interrupted. Reconnecting to setup progress…')).toBeTruthy();
  view.rerender(<SetupTimeline name="Acme" progress={progress} connection="closed" />);
  expect(screen.getByText('Connection closed. Please refresh to reconnect to setup progress.')).toBeTruthy();
  expect(screen.getByText('Create CRM objects').textContent).toContain('In progress');
});

it('preserves completion and failure messages after disconnection', () => {
  const view = render(<SetupTimeline name="Acme" progress={{ status: 'ready', message: 'Your organization is ready.' }} connection="closed" />);
  expect(screen.getByText('Your organization is ready.')).toBeTruthy();
  for (const name of ['Prepare organization', 'Create CRM objects', 'Finish setup']) {
    expect(screen.getByText(name).textContent).toContain('Completed');
  }
  view.rerender(<SetupTimeline name="Acme" progress={{ status: 'failed', step: 'crm', message: 'Custom object conflict.' }} connection="closed" />);
  expect(screen.getByText('Custom object conflict.')).toBeTruthy();
});
