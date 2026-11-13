import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { auth, resetAuth } from '@/test/auth-mock';
import { CreateOrgForm } from './create-org-form';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);

const signedIn = { data: { user: { id: 'u' } }, isPending: false };

function submit(name: string) {
  render(<CreateOrgForm />);
  fireEvent.change(screen.getByLabelText('Organization name'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Create organization' }));
}

beforeEach(() => {
  resetAuth();
  router.push.mockReset();
  router.replace.mockReset();
  auth.session = signedIn;
  auth.orgs = { data: [], isPending: false };
});

describe('CreateOrgForm', () => {
  it('creates the organization with a slug from its name, then goes to the dashboard', async () => {
    submit('  Acme Inc  ');

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/dashboard'));
    expect(auth.checkSlug).toHaveBeenCalledWith({ slug: 'acme-inc' });
    expect(auth.create).toHaveBeenCalledWith({ name: 'Acme Inc', slug: 'acme-inc' });
  });

  it('refreshes the organization list before leaving, so the dashboard never sees the stale empty list', async () => {
    let finishRefetch!: () => void;
    const refetch = vi.fn(() => new Promise<void>((resolve) => (finishRefetch = resolve)));
    const orgsWithRefetch = { data: [], isPending: false, refetch };
    auth.orgs = orgsWithRefetch;
    submit('Acme');

    await waitFor(() => expect(refetch).toHaveBeenCalled());
    expect(auth.create.mock.invocationCallOrder[0]).toBeLessThan(
      refetch.mock.invocationCallOrder[0],
    );
    expect(router.push).not.toHaveBeenCalled();

    finishRefetch();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/dashboard'));
  });

  it('adds a suffix when the slug is taken', async () => {
    auth.checkSlug.mockResolvedValue({ data: null, error: { message: 'slug taken' } });
    submit('Acme');

    await waitFor(() => expect(auth.create).toHaveBeenCalled());
    const { slug } = auth.create.mock.calls[0][0] as { slug: string };
    expect(slug).toMatch(/^acme-[a-z0-9]+$/);
  });

  it('rejects a name with no letters or digits, without calling the API', async () => {
    submit('!!!');

    expect((await screen.findByRole('alert')).textContent).toContain('at least one letter');
    expect(auth.create).not.toHaveBeenCalled();
  });

  it('shows the server error and stays on the page', async () => {
    auth.create.mockResolvedValue({ data: null, error: { message: 'Not allowed' } });
    submit('Acme');

    expect((await screen.findByRole('alert')).textContent).toContain('Not allowed');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('offers Sign out, not Cancel, to someone with no organization yet', () => {
    render(<CreateOrgForm />);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Cancel' })).toBeNull();
  });

  it('offers Cancel back to the dashboard once they have an organization', () => {
    auth.orgs = { data: [{ id: 'org_1' }], isPending: false };
    render(<CreateOrgForm />);
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/dashboard');
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('signs out and returns to login', async () => {
    render(<CreateOrgForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('sends a signed-out visitor to login', () => {
    auth.session = { data: null, isPending: false };
    render(<CreateOrgForm />);
    expect(router.replace).toHaveBeenCalledWith('/login');
  });
});
