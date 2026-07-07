import {
  type AgentJWK,
  generateKeypair,
  signAgentJWT,
  signHostJWT,
} from '@auth/agent';
import {
  type AgentCredentials,
  loadCredentials,
  publicFromPrivate,
  saveCredentials,
} from './credentials';
import { env } from './env';

/**
 * Capability names granted to this agent — the CRM subset of the backend's
 * AGENT_CAPABILITIES (apps/backend/src/libs/better-auth/auth.ts). All have
 * approvalStrength "none", so registration activates immediately.
 */
export const CAPABILITIES = [
  'list_tasks',
  'get_task',
  'create_task',
  'update_task',
  'delete_task',
];

interface RegisterResponse {
  agent_id: string;
  host_id: string;
  name: string;
  mode: string;
  status: string;
}

let credentialsPromise: Promise<AgentCredentials> | null = null;

/**
 * Register an autonomous agent against the Zuko backend over HTTP, vouched
 * for by a pre-provisioned host (ZUKO_HOST_ID + ZUKO_HOST_PRIVATE_JWK, from
 * the backend's `bun run provision:agent-host`).
 *
 * The plugin's dynamic (thumbprint-issuer) host registration is not usable
 * against Zuko — its agent-auth tables use serial Int ids and the string
 * issuer fails the host lookup — so the host must exist first and the host
 * JWT's issuer must be its numeric id.
 */
export async function register(): Promise<AgentCredentials> {
  const e = env();
  if (!e.ZUKO_HOST_ID || !e.ZUKO_HOST_PRIVATE_JWK) {
    throw new Error(
      'Registration needs ZUKO_HOST_ID and ZUKO_HOST_PRIVATE_JWK (run `bun run provision:agent-host` in apps/backend), ' +
        'or provide ZUKO_AGENT_ID and ZUKO_AGENT_PRIVATE_JWK directly.',
    );
  }
  const hostPrivateJwk = JSON.parse(e.ZUKO_HOST_PRIVATE_JWK) as AgentJWK;
  const hostPublicJwk = e.ZUKO_HOST_PUBLIC_JWK
    ? (JSON.parse(e.ZUKO_HOST_PUBLIC_JWK) as AgentJWK)
    : publicFromPrivate(hostPrivateJwk);
  const agentKeypair = await generateKeypair();

  const hostJwt = await signHostJWT({
    hostKeypair: { publicKey: hostPublicJwk, privateKey: hostPrivateJwk },
    // Numeric DB id as issuer so the plugin can locate the host row.
    issuer: String(e.ZUKO_HOST_ID),
    audience: e.ZUKO_BACKEND_URL,
    agentPublicKey: agentKeypair.publicKey,
    hostName: `${e.ZUKO_AGENT_NAME}-host`,
  });

  const res = await fetch(`${e.ZUKO_BACKEND_URL}/auth/agent/register`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${hostJwt}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: e.ZUKO_AGENT_NAME,
      mode: 'autonomous',
      capabilities: CAPABILITIES,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Zuko agent registration failed: ${res.status} ${await res.text()}`,
    );
  }
  const body = (await res.json()) as RegisterResponse;
  if (body.status !== 'active') {
    throw new Error(
      `Zuko agent registration returned status="${body.status}" (agent_id=${body.agent_id}); expected "active"`,
    );
  }

  const creds: AgentCredentials = {
    agentId: body.agent_id,
    agentPublicJwk: agentKeypair.publicKey,
    agentPrivateJwk: agentKeypair.privateKey,
    backendUrl: e.ZUKO_BACKEND_URL,
  };
  await saveCredentials(creds);
  console.log(`[zuko-agent] registered agent id=${body.agent_id}`);
  return creds;
}

async function ensureCredentials(): Promise<AgentCredentials> {
  if (!credentialsPromise) {
    credentialsPromise = (async () => {
      const existing = await loadCredentials();
      return existing ?? register();
    })().catch((err) => {
      credentialsPromise = null;
      throw err;
    });
  }
  return credentialsPromise;
}

// One fresh JWT per request: the backend enforces jti replay protection, so
// agent JWTs are single-use and must never be cached.
async function agentJwt(): Promise<string> {
  const creds = await ensureCredentials();
  return signAgentJWT({
    agentKeypair: {
      publicKey: creds.agentPublicJwk,
      privateKey: creds.agentPrivateJwk,
    },
    agentId: creds.agentId,
    audience: env().ZUKO_BACKEND_URL,
    capabilities: CAPABILITIES,
    expiresInSeconds: 60,
  });
}

/**
 * Call a Zuko /api/agents endpoint. `path` is relative, e.g. "/contacts/query".
 */
export async function zukoFetch<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const e = env();
  const init: RequestInit = {
    method,
    headers: {
      authorization: `Bearer ${await agentJwt()}`,
      'x-org-id': String(e.ZUKO_ORG_ID),
    },
  };
  if (body !== undefined) {
    init.headers = { ...init.headers, 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${e.ZUKO_BACKEND_URL}/api/agents${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zuko API ${method} ${path} → ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}
