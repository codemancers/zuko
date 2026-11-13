import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { auth, resetAuth } from '@/test/auth-mock';
import { AcceptInvitation } from './accept-invitation';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);

const invitation = { organizationName: 'Acme', inviterEmail: 'olive@example.com', role: 'member' };

beforeEach(() => {
  resetAuth();
  router.push.mockReset();
  auth.getInvitation.mockResolvedValue({ data: invitation, error: null });
});

describe('AcceptInvitation', () => {
  it('sends a signed-out visitor to log in or sign up, then back here', () => {
    render(<AcceptInvitation invitationId="inv_1" />);

    const back = encodeURIComponent('/accept-invitation/inv_1');
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe(
      `/login?next=${back}`,
    );
    expect(screen.getByRole('link', { name: 'Sign up' }).getAttribute('href')).toBe(
      `/signup?next=${back}`,
    );
    expect(auth.getInvitation).not.toHaveBeenCalled();
  });

  it('shows a loading state while the session is pending', () => {
    auth.session = { data: null, isPending: true };
    render(<AcceptInvitation invitationId="inv_1" />);
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('describes the invitation once loaded', async () => {
    auth.session = { data: { user: { id: 'u' } }, isPending: false };
    render(<AcceptInvitation invitationId="inv_1" />);

    expect(await screen.findByRole('heading', { name: 'Join Acme' })).toBeTruthy();
    expect(screen.getByText('olive@example.com invited you as member.')).toBeTruthy();
    expect(auth.getInvitation).toHaveBeenCalledWith({ query: { id: 'inv_1' } });
  });

  it('accepts, then goes to the dashboard', async () => {
    auth.session = { data: { user: { id: 'u' } }, isPending: false };
    render(<AcceptInvitation invitationId="inv_1" />);
    await screen.findByRole('heading', { name: 'Join Acme' });

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/dashboard'));
    expect(auth.acceptInvitation).toHaveBeenCalledWith({ invitationId: 'inv_1' });
  });

  it('declines, then goes to the dashboard', async () => {
    auth.session = { data: { user: { id: 'u' } }, isPending: false };
    render(<AcceptInvitation invitationId="inv_1" />);
    await screen.findByRole('heading', { name: 'Join Acme' });

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/dashboard'));
    expect(auth.rejectInvitation).toHaveBeenCalledWith({ invitationId: 'inv_1' });
    expect(auth.acceptInvitation).not.toHaveBeenCalled();
  });

  it('shows why an invitation cannot be loaded, and offers no way to accept it', async () => {
    auth.session = { data: { user: { id: 'u' } }, isPending: false };
    auth.getInvitation.mockResolvedValue({
      data: null,
      error: { message: 'Invitation not found' },
    });
    render(<AcceptInvitation invitationId="gone" />);

    expect((await screen.findByRole('alert')).textContent).toContain('Invitation not found');
    expect(screen.getByText('This invitation cannot be opened.')).toBeTruthy();
    expect(screen.queryByText('Checking your invitation…')).toBeNull();
    expect((screen.getByRole('button', { name: 'Accept' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('shows the error and stays put when accepting fails (e.g. wrong account)', async () => {
    auth.session = { data: { user: { id: 'u' } }, isPending: false };
    auth.acceptInvitation.mockResolvedValue({
      data: null,
      error: { message: 'You are not the recipient of the invitation' },
    });
    render(<AcceptInvitation invitationId="inv_1" />);
    await screen.findByRole('heading', { name: 'Join Acme' });

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect((await screen.findByRole('alert')).textContent).toContain('not the recipient');
    expect(router.push).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Accept' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
