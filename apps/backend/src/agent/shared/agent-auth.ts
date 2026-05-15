import { signAgentJWT, type AgentJWK } from '@auth/agent';

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001';

const internalSecret =
  process.env.AGENT_INTERNAL_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET;

let globalAgentId: number | null = null;
let agentPrivJwk: AgentJWK | null = null;
let agentPubJwk: AgentJWK | null = null;

/**
 * Initialise the agent: call the agent-auth bridge to ensure the autonomous
 * agent row exists and load its private key. Idempotent — re-entrant
 * calls are ignored once initialised.
 */
export async function initAgentAuth(): Promise<void> {
  if (globalAgentId && agentPrivJwk) return;

  const resp = await fetch(`${backendUrl}/api/agent-auth/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': internalSecret ?? '',
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `[agent-auth] init failed: ${resp.status} ${resp.statusText} — ${text}`,
    );
  }

  const { agentId: id, privateJwk } = (await resp.json()) as {
    agentId: number;
    privateJwk: AgentJWK;
  };

  globalAgentId = id;
  agentPrivJwk = privateJwk;
  agentPubJwk = extractPublicJwk(privateJwk);

  console.log(`[agent-auth] Initialised: agentId=${globalAgentId}`);
}

/**
 * Sign a fresh short-lived JWT scoped to the given capabilities.
 * - If agentId is provided, delegates to the bridge sign endpoint (per-chat delegated agent).
 * - Otherwise uses the singleton autonomous agent (fallback / non-chat contexts).
 */
export async function signAgentJwt(
  capabilities?: string[],
  agentId?: number,
): Promise<string> {
  if (agentId != null) {
    return signForAgent(agentId, capabilities);
  }

  if (!globalAgentId || !agentPrivJwk || !agentPubJwk) {
    await initAgentAuth();
  }
  if (!globalAgentId || !agentPrivJwk || !agentPubJwk) {
    throw new Error(
      '[agent-auth] Client not initialized after initAgentAuth()',
    );
  }

  return signAgentJWT({
    agentKeypair: { publicKey: agentPubJwk, privateKey: agentPrivJwk },
    agentId: String(globalAgentId),
    audience: backendUrl,
    capabilities: capabilities ?? [],
    expiresInSeconds: 60,
  });
}

/**
 * Sign a JWT via the bridge's sign endpoint for a per-chat delegated agent.
 */
async function signForAgent(
  agentId: number,
  capabilities?: string[],
): Promise<string> {
  const resp = await fetch(`${backendUrl}/api/agent-auth/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': internalSecret ?? '',
    },
    body: JSON.stringify({ agentId, capabilities, expiresInSeconds: 60 }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `[agent-auth] sign failed for agentId=${agentId}: ${resp.status} ${resp.statusText} — ${text}`,
    );
  }

  const { token } = (await resp.json()) as { token: string };
  return token;
}

function extractPublicJwk(priv: AgentJWK): AgentJWK {
  const { d: _d, key_ops: _ko, ...pub } = priv as Record<string, unknown>;
  return pub as AgentJWK;
}
