import { mergeSetupProgress } from './organization-setup';

it('retains the known step when a later update omits it', () => {
  expect(mergeSetupProgress(
    { status: 'running', step: 'crm', message: 'Creating CRM objects…' },
    { status: 'failed', message: 'Setup failed.' },
  )).toEqual({ status: 'failed', step: 'crm', message: 'Setup failed.' });
});

it('accepts the first progress update with an empty cache', () => {
  expect(mergeSetupProgress(undefined, { status: 'ready', message: 'Ready.' }))
    .toEqual({ status: 'ready', message: 'Ready.', step: undefined });
});
