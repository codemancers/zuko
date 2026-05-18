import type { BetterAuthPlugin } from 'better-auth';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { testUtils, organization } from 'better-auth/plugins';
import { PrismaService } from '../../prisma/prisma.service';
import { agentAuth, type Capability } from '@better-auth/agent-auth';

const prisma = new PrismaService();

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

async function getInitialOrganization(userId: number) {
  const membership = await prisma.member.findFirst({
    where: { userId },
    include: {
      organization: true,
    },
  });
  return membership?.organization;
}

export const auth = betterAuth({
  // basePath: where auth endpoints are mounted (proxy forwards /api/auth/* to backend /auth/*)
  // In prod: proxy at /api/auth forwards to backend, so backend still serves at /auth
  basePath: '/auth',
  // baseURL: full URL where auth endpoints are publicly accessible
  // In prod: use frontend URL (OAuth callbacks go through proxy)
  // In dev: use backend URL directly
  baseURL:
    process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL || 'https://zuko-webv-5725.fly.dev'
      : process.env.BACKEND_URL || 'http://localhost:3001',
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
  ],
  emailAndPassword: {
    enabled: includeEmailAuth,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  account: {
    // Use database instead of cookies for OAuth state to avoid cross-origin issues
    storeStateStrategy: 'database',
    // Temporarily skip state cookie check to debug cross-origin issues
    skipStateCookieCheck: true,
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
