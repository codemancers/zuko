import { fireEvent, render, screen } from '@testing-library/react';
import { auth, resetAuth } from '@/test/auth-mock';
import { OrgGate, OrgSwitcher } from './org-switcher';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);

const acme = { id: 'org_1', name: 'Acme' };
const beta = { id: 'org_2', name: 'Beta' };

function open(name: RegExp) {
  // Radix opens the menu from the keyboard as reliably as from a pointer, and jsdom has no pointer.
  fireEvent.keyDown(screen.getByRole('button', { name }), { key: 'Enter' });
}

beforeEach(() => {
  resetAuth();
  router.replace.mockReset();
  auth.orgs = { data: [acme, beta], isPending: false };
  auth.activeOrg = { data: acme, isPending: false };
});

describe('OrgSwitcher', () => {
  it('shows the active organization on the trigger', () => {
    render(<OrgSwitcher collapsed={false} />);
    expect(screen.getByRole('button', { name: 'Organization: Acme' }).textContent).toContain(
      'Acme',
    );
  });

  it('shows only the badge letter when the sidebar is collapsed', () => {
    render(<OrgSwitcher collapsed />);
    const trigger = screen.getByRole('button', { name: 'Organization: Acme' });
    expect(trigger.textContent).toBe('A');
  });

  it('lists every organization and marks the active one', async () => {
    render(<OrgSwitcher collapsed={false} />);
    open(/Organization: Acme/);

    const items = await screen.findAllByRole('menuitem');
    const labels = items.map((item) => item.textContent);
    expect(labels).toEqual(expect.arrayContaining(['AAcme', 'BBeta']));
    expect(items.find((i) => i.textContent === 'AAcme')?.querySelector('svg')).toBeTruthy();
    expect(items.find((i) => i.textContent === 'BBeta')?.querySelector('svg')).toBeNull();
  });

  it('switches organization on select', async () => {
    render(<OrgSwitcher collapsed={false} />);
    open(/Organization: Acme/);

    fireEvent.click(await screen.findByRole('menuitem', { name: /Beta/ }));

    expect(auth.setActive).toHaveBeenCalledWith({ organizationId: 'org_2' });
  });

  it('links to creating an organization and to settings', async () => {
    render(<OrgSwitcher collapsed={false} />);
    open(/Organization: Acme/);

    expect(
      (await screen.findByRole('menuitem', { name: /Create organization/ })).getAttribute('href'),
    ).toBe('/organizations/new');
    expect(
      screen.getByRole('menuitem', { name: /Organization settings/ }).getAttribute('href'),
    ).toBe('/org/settings/details');
  });

  it('hides settings when no organization is active', async () => {
    auth.activeOrg = { data: null, isPending: false };
    render(<OrgSwitcher collapsed={false} />);
    open(/Organization:/);

    await screen.findByRole('menuitem', { name: /Create organization/ });
    expect(screen.queryByRole('menuitem', { name: /Organization settings/ })).toBeNull();
  });
});

describe('OrgGate', () => {
  it('sends a signed-in user with no organizations to create one', () => {
    auth.session = { data: { user: { id: 'u' } }, isPending: false };
    auth.orgs = { data: [], isPending: false };
    render(<OrgGate />);
    expect(router.replace).toHaveBeenCalledWith('/organizations/new');
  });

  it.each([
    [
      'they already have an organization',
      { data: { user: {} }, isPending: false },
      { data: [acme], isPending: false },
    ],
    ['they are signed out', { data: null, isPending: false }, { data: [], isPending: false }],
    [
      'the list is still loading',
      { data: { user: {} }, isPending: false },
      { data: undefined, isPending: true },
    ],
  ])('does nothing when %s', (_label, session, orgs) => {
    auth.session = session;
    auth.orgs = orgs;
    render(<OrgGate />);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
