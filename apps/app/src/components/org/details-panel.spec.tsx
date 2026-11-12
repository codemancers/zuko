import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EditableField, SAVE_DEBOUNCE_MS } from './details-panel';

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
