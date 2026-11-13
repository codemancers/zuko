import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { auth, makeOrg, resetAuth } from '@/test/auth-mock';
import { MembersSheet } from './members-sheet';

const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  query: '',
}));
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  usePathname: () => '/org/settings/members',
  useSearchParams: () => new URLSearchParams(nav.query),
}));
vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);

type Org = Parameters<typeof MembersSheet>[0]['org'];

function renderSheet(role = 'owner', userId = 'u_owner', org = makeOrg()) {
  return render(<MembersSheet org={org as unknown as Org} myUserId={userId} myRole={role} />);
}

const rowFor = (text: string) => screen.getByText(text).closest('[role="row"]') as HTMLElement;

beforeEach(() => {
  resetAuth();
  nav.query = '';
  nav.router.replace.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('MembersSheet', () => {
  it('lists members and pending invites, but not cancelled ones', () => {
    renderSheet();

    expect(screen.getByText('Olive Owner')).toBeTruthy();
    expect(screen.getByText('sam@example.com')).toBeTruthy();
    expect(screen.getByText('pending@example.com')).toBeTruthy();
    expect(screen.getByText('Invited')).toBeTruthy();
    expect(screen.queryByText('old@example.com')).toBeNull();
  });

  it('marks your own row', () => {
    renderSheet();
    expect(within(rowFor('Olive Owner')).getByText('You')).toBeTruthy();
  });

  describe('as an owner', () => {
    it('can remove other members but not themselves', () => {
      renderSheet();
      expect(
        within(rowFor('Sam Second')).getByRole('button', { name: 'Remove Sam Second' }),
      ).toBeTruthy();
      expect(within(rowFor('Olive Owner')).queryByRole('button', { name: /Remove/ })).toBeNull();
    });

    it('removes a member after confirming', async () => {
      renderSheet();
      fireEvent.click(screen.getByRole('button', { name: 'Remove Sam Second' }));

      await waitFor(() =>
        expect(auth.removeMember).toHaveBeenCalledWith({
          memberIdOrEmail: 'm_two',
          organizationId: 'org_1',
        }),
      );
      expect(window.confirm).toHaveBeenCalledWith('Remove Sam Second from Acme?');
      expect(auth.notify).toHaveBeenCalledWith('$activeOrgSignal');
    });

    it('does nothing when the confirmation is declined', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderSheet();
      fireEvent.click(screen.getByRole('button', { name: 'Remove Sam Second' }));
      expect(auth.removeMember).not.toHaveBeenCalled();
    });

    it('shows the error when removal is refused', async () => {
      auth.removeMember.mockResolvedValue({ data: null, error: { message: 'Not allowed' } });
      renderSheet();
      fireEvent.click(screen.getByRole('button', { name: 'Remove Sam Second' }));
      expect((await screen.findByRole('alert')).textContent).toContain('Not allowed');
    });

    it('changes a role and saves it', async () => {
      renderSheet();
      const select = screen.getByLabelText('Role for sam@example.com') as HTMLSelectElement;
      expect(select.value).toBe('member');

      fireEvent.change(select, { target: { value: 'admin' } });

      await waitFor(() =>
        expect(auth.updateMemberRole).toHaveBeenCalledWith({
          memberId: 'm_two',
          role: 'admin',
          organizationId: 'org_1',
        }),
      );
    });

    it('cannot change their own role', () => {
      renderSheet();
      expect(screen.queryByLabelText('Role for olive@example.com')).toBeNull();
    });

    it('can copy and cancel a pending invite', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      renderSheet();

      fireEvent.click(
        screen.getByRole('button', { name: 'Copy invite link for pending@example.com' }),
      );
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/accept-invitation/inv_1`);

      fireEvent.click(
        screen.getByRole('button', { name: 'Cancel invite for pending@example.com' }),
      );
      await waitFor(() =>
        expect(auth.cancelInvitation).toHaveBeenCalledWith({ invitationId: 'inv_1' }),
      );
    });

    it('invites by email and copies the new link', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      auth.inviteMember.mockResolvedValue({ data: { id: 'inv_new' }, error: null });
      renderSheet();

      fireEvent.click(screen.getByRole('button', { name: /Invite member|Add row/i }));
      const input = await screen.findByPlaceholderText('Email to invite');
      fireEvent.change(input, { target: { value: ' new@example.com ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(auth.inviteMember).toHaveBeenCalledWith({
          email: 'new@example.com',
          role: 'member',
          organizationId: 'org_1',
        }),
      );
      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(
          `${window.location.origin}/accept-invitation/inv_new`,
        ),
      );
    });
  });

  describe('as an admin', () => {
    const org = makeOrg();
    org.members.push({
      id: 'm_third',
      userId: 'u_third',
      role: 'admin',
      user: { name: 'Ada Admin', email: 'ada@example.com', image: null },
    });

    it('cannot remove or re-role an owner', () => {
      renderSheet('admin', 'u_third', org);
      expect(within(rowFor('Olive Owner')).queryByRole('button', { name: /Remove/ })).toBeNull();
      expect(screen.queryByLabelText('Role for olive@example.com')).toBeNull();
    });

    it('can manage a regular member', () => {
      renderSheet('admin', 'u_third', org);
      expect(screen.getByRole('button', { name: 'Remove Sam Second' })).toBeTruthy();
      expect(screen.getByLabelText('Role for sam@example.com')).toBeTruthy();
    });
  });

  describe('as a plain member', () => {
    it('sees the list read-only', () => {
      renderSheet('member', 'u_two');

      expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
      expect(screen.queryByLabelText(/Role for/)).toBeNull();
      expect(screen.queryByRole('button', { name: /Cancel invite/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Invite member|Add row/i })).toBeNull();
    });
  });
});
