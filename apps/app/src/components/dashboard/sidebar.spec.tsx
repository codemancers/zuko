import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '@/test/render';
import { OBJECTS_CHANGED } from '@/lib/objects-events';
import { auth, resetAuth } from '@/test/auth-mock';
import { Sidebar } from './sidebar';
import { Shell } from './shell';

const nav = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: () => undefined }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const api = vi.hoisted(() => vi.fn<(path: string) => Promise<unknown>>());
vi.mock('@/lib/api', () => ({ api }));
vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);

beforeEach(() => {
  resetAuth();
  api.mockReset();
  api.mockResolvedValue({ results: [] });
  nav.pathname = '/dashboard';
});

describe('Sidebar', () => {
  it('links the copilot and records, and leaves the rest as coming soon', () => {
    render(<Sidebar />);
    const main = within(screen.getByRole('navigation', { name: 'Main' }));

    expect(main.getByRole('link', { name: 'Contacts' }).getAttribute('href')).toBe(
      '/records/contact',
    );
    expect(main.getByRole('link', { name: 'Companies' }).getAttribute('href')).toBe(
      '/records/company',
    );
    expect(main.getByRole('link', { name: 'Deals' }).getAttribute('href')).toBe('/records/deal');
    expect(main.getByRole('link', { name: 'New chat' }).getAttribute('href')).toBe('/chat/new');
    expect(main.getByRole('link', { name: 'Your chats' }).getAttribute('href')).toBe(
      '/chat/history',
    );
    expect(main.getAllByRole('link')).toHaveLength(6);
    expect(main.getByText('Campaigns').closest('[aria-disabled="true"]')).toBeTruthy();
    expect(main.getAllByText('Soon').length).toBeGreaterThan(5);
  });

  it('keeps Profile in the sidebar and closes mobile navigation after opening it', async () => {
    auth.session = { data: { user: { id: 'user-a', name: 'Alex Morgan' } } };
    render(
      <Shell>
        <p>Workspace</p>
      </Shell>,
    );
    const profile = screen.getByRole('link', { name: 'Profile' });
    expect(profile.closest('nav')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Org settings' })).toBeNull();
    expect(profile.getAttribute('href')).toBe('/account/profile');
    expect(screen.queryByRole('banner')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Navigation' });
    fireEvent.click(within(dialog).getByRole('link', { name: 'Profile' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('marks the page you are on', () => {
    nav.pathname = '/records/deal';
    render(<Sidebar />);
    const main = within(screen.getByRole('navigation', { name: 'Main' }));

    expect(main.getByRole('link', { name: 'Deals' }).getAttribute('aria-current')).toBe('page');
    expect(main.getByRole('link', { name: 'Contacts' }).getAttribute('aria-current')).toBeNull();
  });

  it("lists the organization's own objects under Records, and follows when one is made", async () => {
    const standard = { name: 'contact', plural_label: 'Contacts', object_kind: 'STANDARD' };
    api.mockResolvedValue({
      results: [standard, { name: 'project', plural_label: 'Projects', object_kind: 'CUSTOM' }],
    });
    render(<Sidebar />);
    const main = within(screen.getByRole('navigation', { name: 'Main' }));

    expect((await main.findByRole('link', { name: 'Projects' })).getAttribute('href')).toBe(
      '/records/project',
    );
    expect(main.getAllByRole('link', { name: 'Contacts' })).toHaveLength(1); // the standard ones are not listed twice

    api.mockResolvedValue({
      results: [
        standard,
        { name: 'project', plural_label: 'Projects', object_kind: 'CUSTOM' },
        { name: 'task', plural_label: 'Tasks', object_kind: 'CUSTOM' },
      ],
    });
    act(() => {
      window.dispatchEvent(new Event(OBJECTS_CHANGED));
    });
    expect(await main.findByRole('link', { name: 'Tasks' })).toBeTruthy();
  });

  it('copes with the objects not loading', async () => {
    api.mockRejectedValue(new Error('signed out'));
    render(<Sidebar />);
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link'),
    ).toHaveLength(6);
  });
});

describe('mobile navigation', () => {
  it('opens the full navigation and closes after following a record link', async () => {
    render(
      <Shell>
        <p>Workspace</p>
      </Shell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Navigation' });
    expect(within(dialog).getByRole('button', { name: /Organization:/ })).toBeTruthy();
    expect(within(dialog).queryByRole('link', { name: 'Org settings' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('link', { name: 'Contacts' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull());
  });

  it('returns focus to the navigation button after closing', async () => {
    render(
      <Shell>
        <p>Workspace</p>
      </Shell>,
    );
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Navigation' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
