import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { organization } from 'better-auth/plugins';
import { describe, expect, it, vi } from 'vitest';
import { audit, AUDIT_PLUGIN_ID, EVENT_SPECS, type AuditEventInput, type AuditOptions } from '../index.js';

const PASSWORD = 'correct-horse-battery-1';

interface Row extends Omit<AuditEventInput, 'metadata'> {
  // The memory adapter stores json columns as strings; real databases return objects.
  metadata: string | Record<string, unknown>;
  createdAt: Date;
}

const parsed = (rows: Row[]) =>
  rows.map((row) => ({ ...row, metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata }));

function createTestAuth(options?: AuditOptions) {
  const db = {
    user: [],
    session: [],
    account: [],
    verification: [],
    organization: [],
    member: [],
    invitation: [],
    auditEvent: [] as Row[],
  };
  // The audit columns are numeric, so use numeric ids like the real database does.
  let nextId = 0;
  const auth = betterAuth({
    baseURL: 'http://localhost:3000',
    secret: 'test-secret-test-secret-test-secret-1234',
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    advanced: { database: { generateId: () => String(++nextId) } },
    plugins: [organization(), audit(options)],
  });
  return { auth, db };
}

async function signUp(auth: ReturnType<typeof createTestAuth>['auth'], name: string) {
  const res = await auth.api.signUpEmail({
    body: { name, email: `${name}@example.com`, password: PASSWORD },
    returnHeaders: true,
  });
  return {
    id: res.response.user.id,
    headers: new Headers({ cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] }),
  };
}

describe('audit plugin', () => {
  it('registers under its id', () => {
    expect(audit().id).toBe(AUDIT_PLUGIN_ID);
  });

  it('records sign-up and sign-in with the actor, and never the password', async () => {
    const { auth, db } = createTestAuth();
    const user = await signUp(auth, 'ada');
    await auth.api.signInEmail({
      body: { email: 'ada@example.com', password: PASSWORD },
      headers: new Headers({ 'user-agent': 'vitest', 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'x-request-id': 'req-7' }),
    });

    expect(db.auditEvent.map((e) => e.event)).toEqual(['user.signed_up', 'user.signed_in']);
    const signedIn = parsed(db.auditEvent)[1];
    expect(signedIn).toMatchObject({
      actorType: 'USER',
      actorId: user.id,
      organizationId: null,
      metadata: { email: 'ada@example.com' },
      ip: '203.0.113.9',
      userAgent: 'vitest',
      requestId: 'req-7',
    });
    expect(JSON.stringify(db.auditEvent)).not.toContain(PASSWORD);
  });

  it('records a failed sign-in as anonymous, with the email but not the password', async () => {
    const { auth, db } = createTestAuth();
    await signUp(auth, 'bob');
    await expect(
      auth.api.signInEmail({ body: { email: 'bob@example.com', password: 'wrong-password-1' } }),
    ).rejects.toThrow(/invalid email or password/i);

    const failed = parsed(db.auditEvent).find((e) => e.event === 'user.sign_in_failed');
    expect(failed).toMatchObject({ actorType: 'ANONYMOUS', actorId: null, metadata: { email: 'bob@example.com' } });
    expect(JSON.stringify(db.auditEvent)).not.toContain('wrong-password-1');
  });

  it('records organization events with the organization, actor and target', async () => {
    const { auth, db } = createTestAuth();
    const owner = await signUp(auth, 'owner');
    const org = await auth.api.createOrganization({ body: { name: 'Acme', slug: 'acme' }, headers: owner.headers });
    const invite = await auth.api.createInvitation({
      body: { email: 'new@example.com', role: 'member', organizationId: org.id },
      headers: owner.headers,
    });

    const created = parsed(db.auditEvent).find((e) => e.event === 'organization.created');
    expect(created).toMatchObject({
      organizationId: org.id,
      actorId: owner.id,
      targetType: 'organization',
      targetId: org.id,
      metadata: { name: 'Acme', slug: 'acme' },
    });
    const invited = parsed(db.auditEvent).find((e) => e.event === 'member.invited');
    expect(invited).toMatchObject({
      organizationId: org.id,
      actorId: owner.id,
      targetType: 'invitation',
      targetId: invite.id,
      metadata: { email: 'new@example.com', role: 'member' },
    });
  });

  it('does not let a request put an event in an organization it does not belong to', async () => {
    const { auth, db } = createTestAuth();
    const owner = await signUp(auth, 'owner');
    const victim = await auth.api.createOrganization({ body: { name: 'Victim', slug: 'victim' }, headers: owner.headers });

    // A stranger names the victim's organization in the body of calls that ignore it.
    const forged = { organizationId: victim.id };
    await auth.api.signUpEmail({ body: { name: 'mallory', email: 'mallory@example.com', password: PASSWORD, ...forged } as never });
    await auth.api.signInEmail({ body: { email: 'mallory@example.com', password: PASSWORD, ...forged } as never });

    const strangers = parsed(db.auditEvent).filter((e) => e.event === 'user.signed_up' || e.event === 'user.signed_in');
    const mallory = strangers.filter((e) => (e.metadata as { email?: string }).email === 'mallory@example.com');
    expect(mallory.map((e) => e.event).sort()).toEqual(['user.signed_in', 'user.signed_up']);
    for (const event of mallory) {
      expect(event.organizationId).not.toBe(victim.id);
      expect(event.organizationId).toBeNull();
    }
    expect(db.auditEvent.filter((e) => e.organizationId === victim.id).map((e) => e.event)).toEqual(['organization.created']);
  });

  it('keeps naming an organization for a member, who may act in more than one', async () => {
    const { auth, db } = createTestAuth();
    const owner = await signUp(auth, 'owner');
    const first = await auth.api.createOrganization({ body: { name: 'First', slug: 'first' }, headers: owner.headers });
    const second = await auth.api.createOrganization({ body: { name: 'Second', slug: 'second' }, headers: owner.headers });
    await auth.api.setActiveOrganization({ body: { organizationId: first.id }, headers: owner.headers });

    await auth.api.createInvitation({ body: { email: 'x@example.com', role: 'member', organizationId: second.id }, headers: owner.headers });

    const invited = db.auditEvent.find((e) => e.event === 'member.invited');
    expect(invited?.organizationId).toBe(second.id); // not the active organization: the one the caller named and belongs to
  });

  it('does not record failed requests other than sign-in', async () => {
    const { auth, db } = createTestAuth();
    const user = await signUp(auth, 'eve');
    const before = db.auditEvent.length;
    await expect(
      auth.api.createInvitation({
        body: { email: 'x@example.com', role: 'member', organizationId: 'no-such-org' },
        headers: user.headers,
      }),
    ).rejects.toThrow(/organization|member/i);
    expect(db.auditEvent).toHaveLength(before);
  });

  it('ignores endpoints that are not audited', async () => {
    const { auth, db } = createTestAuth();
    const user = await signUp(auth, 'finn');
    const before = db.auditEvent.length;
    await auth.api.getSession({ headers: user.headers });
    expect(db.auditEvent).toHaveLength(before);
  });

  it('hands events to a custom writer instead of the table', async () => {
    const write = vi.fn<NonNullable<AuditOptions['write']>>().mockResolvedValue(undefined);
    const { auth, db } = createTestAuth({ write });
    await signUp(auth, 'gina');

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toMatchObject({ event: 'user.signed_up', actorType: 'USER' });
    expect(write.mock.calls[0][1].adapter).toBeDefined();
    expect(db.auditEvent).toHaveLength(0);
  });

  it('never breaks a request when writing fails', async () => {
    const write = vi.fn<NonNullable<AuditOptions['write']>>().mockRejectedValue(new Error('audit store down'));
    const { auth } = createTestAuth({ write });

    const user = await signUp(auth, 'hana');
    expect(user.id).toBeDefined();
    expect(write).toHaveBeenCalled();
  });
});

describe('OAuth consent events', () => {
  const spec = EVENT_SPECS['/oauth2/consent'];
  const query = 'response_type=code&client_id=client_1&scope=openid+mcp%3Aread+mcp%3Awrite&state=s&code_challenge=c&sig=abc';
  const name = (body: Record<string, unknown>) => (typeof spec.event === 'function' ? spec.event(body, {}) : spec.event);
  const details = (body: Record<string, unknown>) => (typeof spec.metadata === 'function' ? spec.metadata(body, {}) : {});

  it('tells an approval from a refusal', () => {
    expect(name({ accept: true, oauth_query: query })).toBe('mcp.connected');
    expect(name({ accept: false, oauth_query: query })).toBe('mcp.connection_denied');
  });

  it('keeps the client and the scopes, not the request plumbing', () => {
    const kept = details({ accept: true, oauth_query: query });
    expect(kept).toEqual({ client_id: 'client_1', scopes: ['openid', 'mcp:read', 'mcp:write'] });
    expect(JSON.stringify(kept)).not.toContain('abc'); // the signature
    expect(JSON.stringify(kept)).not.toContain('code_challenge');
  });

  it('copes with a consent that has no signed request', () => {
    expect(details({ accept: true })).toEqual({ client_id: null, scopes: [] });
  });
});
