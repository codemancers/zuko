/**
 * Which endpoints are audited, under what event name, and which request fields are
 * recorded. Metadata is an explicit whitelist: request bodies carry passwords and
 * tokens, so nothing is copied across unless it is listed here.
 */
export type ActorType = 'USER' | 'API_KEY' | 'SYSTEM' | 'IMPORT' | 'MCP' | 'AGENT' | 'ANONYMOUS';

export interface AuditEventInput {
  /** null for events that belong to no organization. */
  organizationId: string | null;
  actorType: ActorType;
  actorId: string | null;
  event: string;
  targetType: string | null;
  /** Numeric ids only; anything else belongs in metadata. */
  targetId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

type Bag = Record<string, unknown>;

export interface EventSpec {
  /** The event name; a function can choose it from the request, and return null to record nothing. */
  event: string | ((body: Bag, result: Bag) => string | null);
  /** Recorded (as an anonymous event) when the request fails. Most events are only recorded on success. */
  failedEvent?: string;
  targetType?: string;
  /** Where the target id comes from. */
  target?: (body: Bag, result: Bag) => unknown;
  /** Request fields worth keeping, or a function that builds the details (it must never copy secrets). */
  metadata?: readonly string[] | ((body: Bag, result: Bag) => Record<string, unknown>);
  /** Where the organization id comes from, when it is not the body's or the session's. */
  organization?: (body: Bag, result: Bag) => unknown;
}

const fromBody = (key: string) => (body: Bag) => body[key];

/**
 * An OAuth consent carries the authorization request as a signed query string. Only the
 * client and the scopes are worth keeping; the rest (PKCE challenge, signature, state) is
 * request plumbing.
 */
function consentDetails(body: Bag): Record<string, unknown> {
  const query = typeof body['oauth_query'] === 'string' ? new URLSearchParams(body['oauth_query']) : null;
  const scope = query?.get('scope');
  return {
    client_id: query?.get('client_id') ?? null,
    scopes: scope ? scope.split(' ').filter(Boolean) : [],
  };
}
const fromResult = (key: string) => (_body: Bag, result: Bag) => result[key];

export const EVENT_SPECS: Readonly<Record<string, EventSpec>> = {
  '/sign-up/email': { event: 'user.signed_up', metadata: ['email'] },
  '/sign-in/email': { event: 'user.signed_in', failedEvent: 'user.sign_in_failed', metadata: ['email'] },

  '/organization/create': {
    event: 'organization.created',
    targetType: 'organization',
    target: fromResult('id'),
    organization: fromResult('id'),
    metadata: ['name', 'slug'],
  },
  '/organization/delete': {
    event: 'organization.deleted',
    targetType: 'organization',
    target: fromBody('organizationId'),
  },
  '/organization/invite-member': {
    event: 'member.invited',
    targetType: 'invitation',
    target: fromResult('id'),
    metadata: ['email', 'role', 'teamId'],
  },
  '/organization/accept-invitation': {
    event: 'invitation.accepted',
    targetType: 'invitation',
    target: fromBody('invitationId'),
  },
  '/organization/reject-invitation': {
    event: 'invitation.rejected',
    targetType: 'invitation',
    target: fromBody('invitationId'),
  },
  '/organization/cancel-invitation': {
    event: 'invitation.canceled',
    targetType: 'invitation',
    target: fromBody('invitationId'),
  },
  '/organization/remove-member': {
    event: 'member.removed',
    metadata: ['memberIdOrEmail'],
  },
  '/organization/update-member-role': {
    event: 'member.role_changed',
    targetType: 'member',
    target: fromBody('memberId'),
    metadata: ['memberId', 'role'],
  },
  '/organization/leave': { event: 'member.left', organization: fromBody('organizationId') },

  '/organization/create-team': {
    event: 'team.created',
    targetType: 'team',
    target: fromResult('id'),
    metadata: ['name'],
  },
  '/organization/update-team': {
    event: 'team.updated',
    targetType: 'team',
    target: fromBody('teamId'),
    metadata: ['data'],
  },
  '/organization/remove-team': { event: 'team.removed', targetType: 'team', target: fromBody('teamId') },
  '/organization/add-team-member': {
    event: 'team.member_added',
    targetType: 'team',
    target: fromBody('teamId'),
    metadata: ['userId'],
  },
  '/organization/remove-team-member': {
    event: 'team.member_removed',
    targetType: 'team',
    target: fromBody('teamId'),
    metadata: ['userId'],
  },

  // An application (e.g. an MCP client) being approved or turned down by the signed-in user.
  // Disconnecting is not here: it is not a better-auth endpoint, so the app records it itself.
  '/oauth2/consent': {
    event: (body) => (body['accept'] === false ? 'mcp.connection_denied' : 'mcp.connected'),
    metadata: consentDetails,
  },

  '/hierarchy/set-manager': {
    event: 'hierarchy.manager_set',
    targetType: 'user',
    target: fromBody('userId'),
    metadata: ['userId', 'managerId'],
  },
};

/** The largest value a bigint column holds (2^63 - 1). */
const MAX_ID = 9223372036854775807n;

/** Only whole, positive, numeric ids that fit a bigint column can be stored in the numeric id columns. */
export function numericId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === 'bigint' && value > 0n && value <= MAX_ID) {
    return value.toString();
  }
  if (typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= MAX_ID) {
    return value;
  }
  return null;
}

export function pick(source: Bag, keys: readonly string[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys ?? []) {
    if (source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}
