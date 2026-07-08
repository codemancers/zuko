
export interface AgentSessionUser {
  id: string | number;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  [key: string]: unknown;
}

export interface AgentSessionAgent {
  id: string;
  name: string;
  mode: string;
  hostId?: string | null;
  capabilityGrants?: Array<{
    capability: string;
    status: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface AgentSession {
  user: AgentSessionUser;
  agent: AgentSessionAgent;
  host: { id: string; [key: string]: unknown } | null;
}

export interface AgentAuthApi {
  getAgentSession: (opts: { headers: Headers }) => Promise<AgentSession | null>;

  register: (opts: {
    body: {
      name: string;
      capabilities?: string[];
      mode?: 'delegated' | 'autonomous';
    };
    headers: Headers;
  }) => Promise<{
    agent_id: string;
    host_id: string;
    name: string;
    mode: string;
    status: string;
    agent_capability_grants?: unknown[];
    approval?: unknown;
  }>;

  revokeAgent: (opts: {
    body: { id: string };
    headers: Headers;
  }) => Promise<unknown>;
}
