import { vi, type Mock } from 'vitest';

/**
 * A stand-in for `@/lib/auth-client`. Each spec installs it with:
 *
 *   vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);
 *
 * and then drives `auth.*` to set what the hooks return and what the API calls resolve to.
 */
type Hook = { data: unknown; isPending?: boolean };

export const auth: {
  session: Hook;
  orgs: Hook;
  activeOrg: Hook;
  activeMember: Hook;
  create: Mock;
  checkSlug: Mock;
  setActive: Mock;
  update: Mock;
  inviteMember: Mock;
  removeMember: Mock;
  updateMemberRole: Mock;
  cancelInvitation: Mock;
  getInvitation: Mock;
  acceptInvitation: Mock;
  rejectInvitation: Mock;
  notify: Mock;
  signOut: Mock;
} = {
  session: { data: null, isPending: false },
  orgs: { data: undefined, isPending: false },
  activeOrg: { data: undefined, isPending: false },
  activeMember: { data: undefined },
  create: vi.fn(),
  checkSlug: vi.fn(),
  setActive: vi.fn(),
  update: vi.fn(),
  inviteMember: vi.fn(),
  removeMember: vi.fn(),
  updateMemberRole: vi.fn(),
  cancelInvitation: vi.fn(),
  getInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  rejectInvitation: vi.fn(),
  notify: vi.fn(),
  signOut: vi.fn(),
};

const OK = { data: {}, error: null };

/** Owners and admins may do everything, like better-auth's default roles; members may not. */
function checkRolePermission({ role }: { role: string }) {
  return /owner|admin/.test(role);
}

export function resetAuth() {
  auth.session = { data: null, isPending: false };
  auth.orgs = { data: undefined, isPending: false };
  auth.activeOrg = { data: undefined, isPending: false };
  auth.activeMember = { data: undefined };
  for (const key of Object.keys(auth) as (keyof typeof auth)[]) {
    const value = auth[key];
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset();
  }
  auth.checkSlug.mockResolvedValue({ data: { status: true }, error: null });
  for (const key of [
    'create',
    'setActive',
    'update',
    'inviteMember',
    'removeMember',
    'updateMemberRole',
    'cancelInvitation',
    'acceptInvitation',
    'rejectInvitation',
    'signOut',
  ] as const) {
    auth[key].mockResolvedValue(OK);
  }
}

const authClient = {
  useSession: () => auth.session,
  useListOrganizations: () => auth.orgs,
  useActiveOrganization: () => auth.activeOrg,
  useActiveMember: () => auth.activeMember,
  $store: { notify: (...args: unknown[]) => auth.notify(...args) },
  organization: {
    create: (...a: unknown[]) => auth.create(...a),
    checkSlug: (...a: unknown[]) => auth.checkSlug(...a),
    setActive: (...a: unknown[]) => auth.setActive(...a),
    update: (...a: unknown[]) => auth.update(...a),
    inviteMember: (...a: unknown[]) => auth.inviteMember(...a),
    removeMember: (...a: unknown[]) => auth.removeMember(...a),
    updateMemberRole: (...a: unknown[]) => auth.updateMemberRole(...a),
    cancelInvitation: (...a: unknown[]) => auth.cancelInvitation(...a),
    getInvitation: (...a: unknown[]) => auth.getInvitation(...a),
    acceptInvitation: (...a: unknown[]) => auth.acceptInvitation(...a),
    rejectInvitation: (...a: unknown[]) => auth.rejectInvitation(...a),
    checkRolePermission,
  },
};

export const authClientModule = {
  authClient,
  useSession: () => auth.session,
  signOut: (...a: unknown[]) => auth.signOut(...a),
  signIn: {},
  signUp: {},
};

/** The org shape better-auth returns from get-full-organization, trimmed to what the UI reads. */
export function makeOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org_1',
    name: 'Acme',
    slug: 'acme',
    createdAt: '2026-11-12T00:00:00.000Z',
    members: [
      member('m_owner', 'u_owner', 'Olive Owner', 'olive@example.com', 'owner'),
      member('m_two', 'u_two', 'Sam Second', 'sam@example.com', 'member'),
    ],
    invitations: [
      { id: 'inv_1', email: 'pending@example.com', role: 'member', status: 'pending' },
      { id: 'inv_old', email: 'old@example.com', role: 'member', status: 'canceled' },
    ],
    ...overrides,
  };
}

export function member(id: string, userId: string, name: string, email: string, role: string) {
  return { id, userId, role, user: { name, email, image: null } };
}
