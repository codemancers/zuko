import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentJWK } from '@auth/agent';
import { env } from './env';

export interface AgentCredentials {
  agentId: string;
  agentPublicJwk: AgentJWK;
  agentPrivateJwk: AgentJWK;
  /** Backend the agent was registered against — credentials are not portable across backends. */
  backendUrl: string;
}

function stateFile(): string {
  return join(env().ZUKO_AGENT_STATE_DIR, 'agent-credentials.json');
}

/**
 * Load credentials, in order of preference:
 * 1. ZUKO_AGENT_ID + ZUKO_AGENT_PRIVATE_JWK (+ ZUKO_AGENT_PUBLIC_JWK) env vars
 *    — the production path; register once, store in the secret manager.
 * 2. The state file written by a previous self-registration.
 * Returns null when neither exists (caller should self-register).
 */
export async function loadCredentials(): Promise<AgentCredentials | null> {
  const e = env();

  if (e.ZUKO_AGENT_ID && e.ZUKO_AGENT_PRIVATE_JWK) {
    const agentPrivateJwk = JSON.parse(e.ZUKO_AGENT_PRIVATE_JWK) as AgentJWK;
    const agentPublicJwk = e.ZUKO_AGENT_PUBLIC_JWK
      ? (JSON.parse(e.ZUKO_AGENT_PUBLIC_JWK) as AgentJWK)
      : publicFromPrivate(agentPrivateJwk);
    return {
      agentId: e.ZUKO_AGENT_ID,
      agentPrivateJwk,
      agentPublicJwk,
      backendUrl: e.ZUKO_BACKEND_URL,
    };
  }

  try {
    const raw = await readFile(stateFile(), 'utf8');
    const creds = JSON.parse(raw) as AgentCredentials;
    if (creds.backendUrl !== e.ZUKO_BACKEND_URL) {
      console.warn(
        `[zuko-agent] stored credentials are for ${creds.backendUrl}, not ${e.ZUKO_BACKEND_URL} — re-registering`,
      );
      return null;
    }
    return creds;
  } catch {
    return null;
  }
}

export async function saveCredentials(creds: AgentCredentials): Promise<void> {
  await mkdir(env().ZUKO_AGENT_STATE_DIR, { recursive: true });
  const file = stateFile();
  await writeFile(file, JSON.stringify(creds, null, 2), 'utf8');
  await chmod(file, 0o600);
}

/** An Ed25519/EC public JWK is the private JWK without the private component. */
export function publicFromPrivate(priv: AgentJWK): AgentJWK {
  const { d: _d, ...pub } = priv as AgentJWK & { d?: string };
  return pub as AgentJWK;
}
