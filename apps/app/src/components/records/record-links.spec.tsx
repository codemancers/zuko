import { act, fireEvent, screen } from '@testing-library/react';
import { render } from '@/test/render';
import { LinkSearch } from './record-links';
import type { AssociationDef } from '@/lib/records';

const api = vi.hoisted(() =>
  vi.fn<
    (
      path: string,
      init?: { json?: { filter_groups: { filters: { value: unknown }[] }[] } },
    ) => Promise<unknown>
  >(),
);
vi.mock('@/lib/api', () => ({ api }));
const association: AssociationDef = {
  name: 'contact_company',
  label: 'Companies',
  singular_label: 'Company',
  target: 'company',
  many: true,
  side: 'forward',
  field: 'companies',
};
const entries = [
  { id: '1', properties: { name: 'Globex' } },
  { id: '2', properties: { name: 'Figma' } },
];
const settle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
};
const search = () => screen.getByRole('searchbox', { name: 'Search companies to link' });

beforeEach(() => {
  vi.useFakeTimers();
  api.mockReset();
  api.mockImplementation(async (path, init) => {
    if (path === '/api/v1/objects/company')
      return {
        name: 'company',
        label: 'Company',
        fields: [{ name: 'name', type: 'TEXT', filterable: true }],
      };
    const text = String(init!.json!.filter_groups[0].filters[0].value).toLowerCase();
    return { results: entries.filter((row) => row.properties.name.toLowerCase().includes(text)) };
  });
});
afterEach(() => vi.useRealTimers());

describe('linked record search', () => {
  it('shows searching while the request is pending, then shows matches', async () => {
    render(<LinkSearch association={association} linked={[]} onAdd={() => {}} />);
    fireEvent.change(search(), { target: { value: 'g' } });
    expect(screen.getByRole('status').textContent).toContain('Searching');
    expect(screen.queryByText('Nothing found.')).toBeNull();
    await settle();
    expect(screen.getByRole('button', { name: 'Link Globex' })).toBeTruthy();
  });

  it('hides stale results as soon as the search changes', async () => {
    render(<LinkSearch association={association} linked={[]} onAdd={() => {}} />);
    fireEvent.change(search(), { target: { value: 'glob' } });
    await settle();
    expect(screen.getByRole('button', { name: 'Link Globex' })).toBeTruthy();
    fireEvent.change(search(), { target: { value: 'fig' } });
    expect(screen.queryByRole('button', { name: 'Link Globex' })).toBeNull();
    await settle();
    expect(screen.getByRole('button', { name: 'Link Figma' })).toBeTruthy();
  });

  it('shows the server error and retries the same search', async () => {
    api.mockRejectedValueOnce(new Error('The server is unavailable'));
    render(<LinkSearch association={association} linked={[]} onAdd={() => {}} />);
    fireEvent.change(search(), { target: { value: 'glob' } });
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('The server is unavailable');
    expect(screen.queryByText('Nothing found.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry search' }));
    await settle();
    expect(screen.getByRole('button', { name: 'Link Globex' })).toBeTruthy();
    expect((search() as HTMLInputElement).value).toBe('glob');
  });

  it('lets the keyboard move through matches and back to the search', async () => {
    render(<LinkSearch association={association} linked={[]} onAdd={() => {}} />);
    fireEvent.change(search(), { target: { value: 'g' } });
    await settle();
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Link Globex' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Link Figma' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(search());
  });

  it('keeps the search text when linking is refused', async () => {
    render(
      <LinkSearch
        association={association}
        linked={[]}
        onAdd={async () => {
          throw new Error('Not allowed to change this link');
        }}
      />,
    );
    fireEvent.change(search(), { target: { value: 'glob' } });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Link Globex' }));
    });
    expect(screen.getByRole('alert').textContent).toContain('Not allowed to change this link');
    expect((search() as HTMLInputElement).value).toBe('glob');
  });

  it('distinguishes already-linked matches from no results', async () => {
    render(
      <LinkSearch
        association={association}
        linked={[{ id: '1', label: 'Globex' }]}
        onAdd={() => {}}
      />,
    );
    fireEvent.change(search(), { target: { value: 'glob' } });
    await settle();
    expect(screen.getByRole('status').textContent).toBe('All matches are already linked.');
  });
});
