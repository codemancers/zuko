import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSalesOverviewAccess } from '@/hooks/use-sales-overview-access';
type LoadState<T> = {
  data: T | null;
  isPending: boolean;
  error: { message: string } | null;
};
type SessionData = {
  user: { id: string; role: string };
  session: { activeOrganizationId: string | null };
};
type OrgData = { id: string; members: { userId: string; role: string }[] };
const state = vi.hoisted(() => ({
  session: {
    data: null,
    isPending: false,
    error: null,
  } as LoadState<SessionData>,
  org: { data: null, isPending: false, error: null } as LoadState<OrgData>,
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => state.session,
    useActiveOrganization: () => state.org,
  },
}));
beforeEach(() => {
  state.session = {
    data: {
      user: { id: '1', role: 'admin' },
      session: { activeOrganizationId: '7' },
    },
    isPending: false,
    error: null,
  };
  state.org = {
    data: { id: '7', members: [{ userId: '1', role: 'owner' }] },
    isPending: false,
    error: null,
  };
});
describe('useSalesOverviewAccess', () => {
  it.each(['admin', 'owner'])('allows organization %s', (role) => {
    state.org.data!.members[0].role = role;
    expect(
      renderHook(() => useSalesOverviewAccess()).result.current.allowed,
    ).toBe(true);
  });
  it.each(['member', 'accountant', 'none', 'superadmin'])(
    'denies %s even for application admin',
    (role) => {
      state.org.data!.members[0].role = role;
      expect(
        renderHook(() => useSalesOverviewAccess()).result.current.allowed,
      ).toBe(false);
    },
  );
  it('denies nonmembership', () => {
    state.org.data!.members = [];
    expect(
      renderHook(() => useSalesOverviewAccess()).result.current.allowed,
    ).toBe(false);
  });
  it.each(['session', 'org'] as const)(
    'denies while %s loads even with stale data',
    (key) => {
      state[key].isPending = true;
      expect(renderHook(() => useSalesOverviewAccess()).result.current).toEqual(
        { allowed: false, loading: true },
      );
    },
  );
  it.each(['session', 'org'] as const)(
    'denies %s errors even with stale data',
    (key) => {
      state[key].error = { message: 'failed' };
      expect(
        renderHook(() => useSalesOverviewAccess()).result.current.allowed,
      ).toBe(false);
    },
  );
  it('denies stale organization during switch and responds to a downgrade', () => {
    const { result, rerender } = renderHook(() => useSalesOverviewAccess());
    state.session.data!.session.activeOrganizationId = '8';
    rerender();
    expect(result.current.allowed).toBe(false);
    state.org.data = { id: '8', members: [{ userId: '1', role: 'admin' }] };
    rerender();
    expect(result.current.allowed).toBe(true);
    state.org.data!.members[0].role = 'member';
    rerender();
    expect(result.current.allowed).toBe(false);
  });
  it('denies no active organization', () => {
    state.session.data!.session.activeOrganizationId = null;
    expect(
      renderHook(() => useSalesOverviewAccess()).result.current.allowed,
    ).toBe(false);
  });
  it('denies a logged-out session', () => {
    state.session.data = null;
    expect(
      renderHook(() => useSalesOverviewAccess()).result.current.allowed,
    ).toBe(false);
  });
  it('allows an active organization owner', () => {
    expect(renderHook(() => useSalesOverviewAccess()).result.current).toEqual({
      allowed: true,
      loading: false,
    });
  });
});
