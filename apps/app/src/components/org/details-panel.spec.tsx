import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { auth, makeOrg, resetAuth } from '@/test/auth-mock';
import { DetailsPanel, EditableField, SAVE_DEBOUNCE_MS } from './details-panel';

vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);

type Save = (next: string) => Promise<string | null>;

function setup(opts: { value?: string; canEdit?: boolean; onSave?: Save } = {}) {
  const onSave = vi.fn<Save>(opts.onSave ?? (async () => null));
  render(
    <EditableField
      label="Name"
      value={opts.value ?? 'Acme'}
      canEdit={opts.canEdit ?? true}
      onSave={onSave}
    />,
  );
  return { onSave, input: screen.getByLabelText('Name') as HTMLInputElement };
}

const type = (input: HTMLElement, text: string) =>
  fireEvent.change(input, { target: { value: text } });
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('EditableField', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('saves once, after typing pauses', async () => {
    const { onSave, input } = setup();
    fireEvent.focus(input);
    type(input, 'Acm');
    await wait(SAVE_DEBOUNCE_MS - 100);
    type(input, 'Acme Corp'); // another keystroke restarts the timer
    await wait(SAVE_DEBOUNCE_MS - 100);
    expect(onSave).not.toHaveBeenCalled();

    await wait(200);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Acme Corp');
  });

  it('shows a tick once saved, and hides it when typing resumes', async () => {
    const { input } = setup();
    fireEvent.focus(input);
    type(input, 'Acme Corp');
    await wait(SAVE_DEBOUNCE_MS + 50);
    expect(screen.getByLabelText('Saved')).toBeTruthy();

    type(input, 'Acme Corp 2');
    expect(screen.queryByLabelText('Saved')).toBeNull();
  });

  it('saves immediately on blur without waiting for the timer', async () => {
    const { onSave, input } = setup();
    fireEvent.focus(input);
    type(input, 'Acme Corp');
    fireEvent.blur(input);
    await wait(0);
    expect(onSave).toHaveBeenCalledWith('Acme Corp');
  });

  it('saves on Enter', async () => {
    const { onSave, input } = setup();
    act(() => input.focus());
    type(input, 'Acme Corp');
    fireEvent.keyDown(input, { key: 'Enter' });
    await wait(0);
    expect(onSave).toHaveBeenCalledWith('Acme Corp');
  });

  it('reverts on Escape and never saves', async () => {
    const { onSave, input } = setup();
    act(() => input.focus());
    type(input, 'Acme Corp');
    fireEvent.keyDown(input, { key: 'Escape' });
    await wait(SAVE_DEBOUNCE_MS + 50);
    expect(onSave).not.toHaveBeenCalled();
    expect(input.value).toBe('Acme');
  });

  it('does not save an unchanged or empty value', async () => {
    const { onSave, input } = setup();
    fireEvent.focus(input);
    type(input, 'Acme');
    await wait(SAVE_DEBOUNCE_MS + 50);
    type(input, '   ');
    fireEvent.blur(input);
    await wait(SAVE_DEBOUNCE_MS + 50);
    expect(onSave).not.toHaveBeenCalled();
    expect(input.value).toBe('Acme'); // empty reverts to the saved text
  });

  it('shows a refusal and does not show a tick', async () => {
    const { input } = setup({ onSave: async () => 'That slug is taken' });
    fireEvent.focus(input);
    type(input, 'taken');
    await wait(SAVE_DEBOUNCE_MS + 50);
    expect(screen.getByRole('alert').textContent).toBe('That slug is taken');
    expect(screen.queryByLabelText('Saved')).toBeNull();
    expect(input.value).toBe('taken'); // kept so it can be fixed
  });

  it('saves text typed while a request is in flight, one request at a time', async () => {
    let finish: (failure: string | null) => void = () => undefined;
    const onSave = vi.fn<Save>(() => new Promise((resolve) => (finish = resolve)));
    const { input } = setup({ onSave });
    fireEvent.focus(input);

    type(input, 'First');
    await wait(SAVE_DEBOUNCE_MS + 50);
    expect(onSave).toHaveBeenCalledTimes(1);

    type(input, 'First Second'); // typed during the first request
    await wait(SAVE_DEBOUNCE_MS + 50);
    expect(onSave).toHaveBeenCalledTimes(1); // not overlapping

    await act(async () => finish(null));
    await wait(0);
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith('First Second');
  });

  it('is read-only without edit permission', () => {
    const { input } = setup({ canEdit: false });
    expect(input.readOnly).toBe(true);
  });
});

describe('DetailsPanel', () => {
  type Org = Parameters<typeof DetailsPanel>[0]['org'];
  const renderPanel = (canEdit: boolean) =>
    render(<DetailsPanel org={makeOrg() as unknown as Org} role="owner" canEdit={canEdit} />);

  beforeEach(() => {
    resetAuth();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows all the organization data', () => {
    renderPanel(true);

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Acme');
    expect((screen.getByLabelText('Slug') as HTMLInputElement).value).toBe('acme');
    expect(screen.getByText('Created')).toBeTruthy();
    expect(screen.getByText('12 November 2026')).toBeTruthy();
    expect(screen.getByText('owner')).toBeTruthy();
  });

  it('counts members, and only pending invitations', () => {
    renderPanel(true);
    const value = (label: string) => screen.getByText(label).closest('div')?.textContent;

    expect(value('Members')).toBe('Members2');
    expect(value('Pending invites')).toBe('Pending invites1'); // the cancelled one is excluded
  });

  it('saves a renamed organization through better-auth', async () => {
    renderPanel(true);
    const name = screen.getByLabelText('Name');
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'Acme Corp' } });

    await act(() => vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 50));

    expect(auth.update).toHaveBeenCalledWith({
      organizationId: 'org_1',
      data: { name: 'Acme Corp' },
    });
  });

  it('saves the slug on its own, without touching the name', async () => {
    renderPanel(true);
    const slug = screen.getByLabelText('Slug');
    fireEvent.focus(slug);
    fireEvent.change(slug, { target: { value: 'acme-corp' } });

    await act(() => vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 50));

    expect(auth.update).toHaveBeenCalledWith({
      organizationId: 'org_1',
      data: { slug: 'acme-corp' },
    });
  });

  it('reports a refused save on the field', async () => {
    auth.update.mockResolvedValue({ data: null, error: { message: 'Slug already taken' } });
    renderPanel(true);
    const slug = screen.getByLabelText('Slug');
    fireEvent.focus(slug);
    fireEvent.change(slug, { target: { value: 'taken' } });

    await act(() => vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 50));

    expect(screen.getByRole('alert').textContent).toBe('Slug already taken');
  });

  it('is read-only for people who cannot edit', () => {
    renderPanel(false);
    expect((screen.getByLabelText('Name') as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText('Slug') as HTMLInputElement).readOnly).toBe(true);
  });
});
