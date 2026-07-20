import { betterAuth, type BetterAuthPlugin } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { testUtils, organization, jwt } from 'better-auth/plugins';
import { oauthProvider } from '@better-auth/oauth-provider';
import { PrismaService } from '../../prisma/prisma.service';
import { agentAuth, type Capability } from '@better-auth/agent-auth';

const prisma = new PrismaService();

// OAuth scopes granted to external MCP clients (Claude, Cursor, …).
// Resource servers (McpController) enforce these per tool.
export const MCP_SCOPES = ['tasks:read', 'tasks:write', 'organizations:read'];

const AGENT_CAPABILITIES: Capability[] = [
  // CRM — deals
  {
    name: 'get_deal_details',
    description: 'Get full details for a single deal',
    approvalStrength: 'none',
  },
  {
    name: 'query_deals',
    description: 'Query deals with filters and aggregations',
    approvalStrength: 'none',
  },
  {
    name: 'create_deal',
    description: 'Create a new deal',
    approvalStrength: 'none',
  },
  {
    name: 'update_deal',
    description: 'Update an existing deal',
    approvalStrength: 'none',
  },
  // CRM — contacts
  {
    name: 'get_contact_details',
    description: 'Get full details for a contact',
    approvalStrength: 'none',
  },
  {
    name: 'get_contact_owner',
    description: 'Get the owner of a contact',
    approvalStrength: 'none',
  },
  {
    name: 'query_contacts',
    description: 'Query contacts with filters',
    approvalStrength: 'none',
  },
  {
    name: 'create_contact',
    description: 'Create a new contact',
    approvalStrength: 'none',
  },
  {
    name: 'update_contact',
    description: 'Update an existing contact',
    approvalStrength: 'none',
  },
  // CRM — companies
  {
    name: 'get_company_details',
    description: 'Get full details for a company',
    approvalStrength: 'none',
  },
  {
    name: 'query_companies',
    description: 'Query companies with filters',
    approvalStrength: 'none',
  },
  {
    name: 'create_company',
    description: 'Create a new company',
    approvalStrength: 'none',
  },
  {
    name: 'update_company',
    description: 'Update an existing company',
    approvalStrength: 'none',
  },
  // CRM — context
  {
    name: 'get_conversation_context',
    description: 'Get the current conversation context entities',
    approvalStrength: 'none',
  },
  // Sandbox — filesystem
  {
    name: 'bash',
    description: 'Run a shell command in the sandbox workspace',
    approvalStrength: 'none',
  },
  {
    name: 'read',
    description: 'Read a file from the sandbox filesystem',
    approvalStrength: 'none',
  },
  {
    name: 'write',
    description: 'Write a file to the sandbox filesystem',
    approvalStrength: 'none',
  },
  {
    name: 'edit',
    description: 'Edit a file in the sandbox filesystem',
    approvalStrength: 'none',
  },
  {
    name: 'glob',
    description: 'Glob file patterns in the sandbox',
    approvalStrength: 'none',
  },
  {
    name: 'grep',
    description: 'Grep for patterns across sandbox files',
    approvalStrength: 'none',
  },
  {
    name: 'stat',
    description: 'Stat a file or directory in the sandbox',
    approvalStrength: 'none',
  },
  {
    name: 'mkdir',
    description: 'Create a directory in the sandbox',
    approvalStrength: 'none',
  },
  {
    name: 'readdir',
    description: 'List directory contents in the sandbox',
    approvalStrength: 'none',
  },
  // Network
  {
    name: 'web_fetch',
    description: 'Fetch a URL and return its text body',
    approvalStrength: 'none',
  },
  // Interactive
  {
    name: 'ask_user_question',
    description: 'Pause and ask the user a clarifying question',
    approvalStrength: 'none',
  },
  {
    name: 'todo_write',
    description: 'Write agent scratchpad todos',
    approvalStrength: 'none',
  },
];

const includeEmailAuth =
  process.env.NEXT_PUBLIC_BETTER_AUTH_INCLUDE_EMAILS_AUTH === 'true';

const betterAuthUrl = process.env.BACKEND_URL || 'http://localhost:3001';

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

async function getInitialOrganization(userId: number) {
  const membership = await prisma.member.findFirst({
    where: { userId },
    include: {
      organization: true,
    },
  });
  return membership?.organization;
}

// betterAuth's return type references internal packages that aren't portable.
// Using any to avoid build errors while maintaining type safety through inference.
const authInstance: any = betterAuth({
  // basePath: where auth endpoints are mounted (proxy forwards /api/auth/* to backend /auth/*)
  // In prod: proxy at /api/auth forwards to backend, so backend still serves at /auth
  basePath: '/auth',
  // Disable the jwt plugin's /auth/token shortcut — it mints session-derived
  // JWTs that bypass OAuth consent/scoping. oauth2/token is the only token issuer.
  disabledPaths: ['/token'],
  baseURL: betterAuthUrl,
  // Explicitly set secret to ensure consistency between tests and runtime
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',') ?? [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4200',
  ],
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  plugins: [
    ...(process.env.NODE_ENV === 'test' ? [testUtils()] : []),
    organization({
      teams: {
        enabled: true,
      },
    }),
    agentAuth({
      providerName: 'Zuko',
      providerDescription: 'Zuko CRM — AI agent access',
      modes: ['delegated', 'autonomous'],
      maxAgentsPerUser: 0,
      allowDynamicHostRegistration: true,
      defaultHostCapabilities: AGENT_CAPABILITIES.map((c) => c.name),
      capabilities: AGENT_CAPABILITIES,
      resolveAutonomousUser: () => ({
        id: '0',
        name: 'Zuko Agent',
        email: 'agent@zuko.internal',
      }),
      jwtMaxAge: 60,
      agentSessionTTL: 3600,
    }) as unknown as BetterAuthPlugin,
    // Signing keys + /auth/jwks endpoint. Required by oauthProvider for
    // JWT-formatted access tokens (resource servers verify locally via JWKS).
    // disableSettingJwtHeader: the plugin otherwise runs an after-hook on EVERY
    // /get-session that reads the jwks table from the DB and signs a JWT into a
    // `set-auth-jwt` response header. Since our global AppAuthGuard resolves a
    // session on every authed request, that was a DB round-trip per request
    // (0.2–1.4s in prod traces). Nothing consumes `set-auth-jwt` (the frontend
    // client has no jwtClient plugin; MCP gets tokens via oauth2/token and
    // verifies via /auth/jwks — both unaffected), so we turn it off.
    jwt({ disableSettingJwtHeader: true }),
    // OAuth 2.1 authorization server — lets external MCP clients (Claude,
    // Cursor, VS Code) obtain user-scoped access tokens via the standard
    // authorize/consent flow. Replaces the deprecated mcp() plugin.
    // Tables in libs/models/prisma/core.prisma (OauthClient, OauthAccessToken, etc.)
    oauthProvider({
      loginPage: `${frontendUrl}/sign-in`,
      consentPage: `${frontendUrl}/oauth/consent`,
      // MCP clients self-register (RFC 7591). Unauthenticated registration is
      // required for public clients like Claude Code; it only creates a client
      // row — every token still goes through user login + consent.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      scopes: ['openid', 'profile', 'email', 'offline_access', ...MCP_SCOPES],

      // Audiences tokens may be minted for (RFC 8707 resource parameter).
      // JWT access tokens carry this as `aud`; mcp.bootstrap.ts verifies it.
      validAudiences: [`${betterAuthUrl}/api/mcp`],
      silenceWarnings: {
        // Root-level RFC 8414 discovery routes are served by
        // WellKnownController (apps/backend/src/app/mcp/well-known.controller.ts).
        oauthAuthServerConfig: true,
        openidConfig: true,
      },
    }),
  ],

  emailAndPassword: {
    enabled: includeEmailAuth,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      // Send Google's callback to the FRONTEND, not the backend. Default is
      // ${baseURL}/auth/callback/google (backend) — the browser would then be
      // redirected straight to the backend, which sets the session cookie on the
      // backend host, and the frontend origin never receives it (get-session →
      // 401). Routing the callback through the frontend's /auth proxy lets it
      // rewrite Set-Cookie onto the frontend domain. GOOGLE_REDIRECT_URI
      // overrides. NOTE: this exact URL must be an authorized redirect URI in
      // the Google Cloud console.
      redirectURI:
        process.env.GOOGLE_REDIRECT_URI ||
        `${frontendUrl}/auth/callback/google`,
    },
  },
  account: {
    // Use database instead of cookies for OAuth state to avoid cross-origin issues
    storeStateStrategy: 'database',
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  advanced: {
    database: {
      generateId: 'serial',
    },
    // Auth traffic arrives via the frontend's /auth proxy, so the backend can't
    // see the browser IP by default — better-auth (>=1.6) then rate-limits every
    // user under one shared bucket (/sign-in* = 3 req / 10s) → spurious 429s.
    // The proxy forwards the real browser IP as `x-real-ip` (read first);
    // `fly-client-ip` covers direct, non-proxied access (e.g. MCP clients).
    ipAddress: {
      ipAddressHeaders: ['x-real-ip', 'fly-client-ip'],
    },
    // Use secure cookies only in production (HTTPS)
    // In development (HTTP/localhost), cookies must use secure: false
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes:
      process.env.NODE_ENV === 'production'
        ? {
            sameSite: 'none', // Allow cross-origin requests
            secure: true, // HTTPS only
          }
        : {
            sameSite: 'lax', // Standard for same-origin
            secure: false, // Allow HTTP in development
          },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Auto-verify emails in non-production so that better-auth's
          // organization.listUserInvitations() (which requires emailVerified)
          // works for newly signed-up users in e2e tests.
          if (process.env.NODE_ENV !== 'production') {
            return { data: { ...user, emailVerified: true } };
          }
          return undefined;
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const organization = await getInitialOrganization(
            Number(session.userId),
          );
          return {
            data: {
              ...session,
              activeOrganizationId: organization?.id?.toString(),
            },
          };
        },
      },
    },
  },
});

export const auth = authInstance;
