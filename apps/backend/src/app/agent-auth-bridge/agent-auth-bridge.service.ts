import { Injectable, Logger } from '@nestjs/common';
import {
  generateKeypair,
  signHostJWT,
  signAgentJWT as signAgentJwtRaw,
  type AgentJWK,
} from '@auth/agent';
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { agentAuthApi } from '../../agent-auth-api';

const DEFAULT_AGENT_SESSION_TTL_SECONDS = 3600;

const POOL_HOST_NAME = 'zuko-pool-host';
const ZUKO_AGENT_NAME = 'zuko-ai-agent';

const AGENT_CAPABILITIES = [
  // CRM — deals
  'get_deal_details',
  'query_deals',
  'create_deal',
  'update_deal',
  // CRM — contacts
  'get_contact_details',
  'get_contact_owner',
  'query_contacts',
  'create_contact',
  'update_contact',
  // CRM — companies
  'get_company_details',
  'query_companies',
  'create_company',
  'update_company',
  // CRM — context
  'get_conversation_context',
  // Sandbox — filesystem
  'bash',
  'read',
  'write',
  'edit',
  'glob',
  'grep',
  'stat',
  'mkdir',
  'readdir',
  // Network
  'web_fetch',
  // Interactive
  'ask_user_question',
  'todo_write',
];

function authBaseUrl(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.BETTER_AUTH_URL ||
    'http://localhost:3001'
  );
}

function encryptionKey(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'agent-auth-bridge: BETTER_AUTH_SECRET is required to encrypt private keys',
    );
  }
  return secret;
}

export interface AutonomousAgentCredentials {
  agentId: number;
  privateJwk: AgentJWK;
  expiresAt: number;
}

export interface DelegatedAgentCredentials {
  agentId: number;
  capabilities: string[];
}

@Injectable()
export class AgentAuthBridgeService {
  private readonly logger = new Logger(AgentAuthBridgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensureGlobalPoolHost(): Promise<number> {
    const existing = await this.prisma.agentHost.findFirst({
      where: { name: POOL_HOST_NAME, userId: null, status: 'active' },
      select: {
        id: true,
        publicKey: true,
        signingKey: { select: { id: true } },
      },
    });

    if (existing?.publicKey && existing.signingKey) {
      return existing.id;
    }

    const keypair = await generateKeypair();
    const encryptedPrivJwk = await symmetricEncrypt({
      key: encryptionKey(),
      data: JSON.stringify(keypair.privateKey),
    });

    const host = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.agentHost.update({
          where: { id: existing.id },
          data: {
            publicKey: JSON.stringify(keypair.publicKey),
            kid: keypair.publicKey.kid ?? null,
            defaultCapabilities: JSON.stringify(AGENT_CAPABILITIES),
            activatedAt: new Date(),
          },
        });
        await tx.hostSigningKey.upsert({
          where: { agentHostId: existing.id },
          update: {
            privateJwkEncrypted: encryptedPrivJwk,
            rotatedAt: new Date(),
          },
          create: {
            agentHostId: existing.id,
            privateJwkEncrypted: encryptedPrivJwk,
          },
        });
        return { id: existing.id };
      }

      const created = await tx.agentHost.create({
        data: {
          userId: null,
          name: POOL_HOST_NAME,
          publicKey: JSON.stringify(keypair.publicKey),
          kid: keypair.publicKey.kid ?? null,
          defaultCapabilities: JSON.stringify(AGENT_CAPABILITIES),
          status: 'active',
          activatedAt: new Date(),
        },
        select: { id: true },
      });
      await tx.hostSigningKey.create({
        data: {
          agentHostId: created.id,
          privateJwkEncrypted: encryptedPrivJwk,
        },
      });
      return created;
    });

    this.logger.log(`created global pool host id=${host.id}`);
    return host.id;
  }

  /**
   * Idempotent: finds the existing autonomous agent or registers a new one.
   * Returns the agent id (Int) and its decrypted private JWK so the caller
   * can sign JWTs locally without round-tripping the backend each time.
   */
  async ensureAutonomousAgent(): Promise<AutonomousAgentCredentials> {
    const existing = await this.prisma.agent.findFirst({
      where: { name: ZUKO_AGENT_NAME, mode: 'autonomous', status: 'active' },
      include: { signingKey: true },
    });

    if (existing?.signingKey) {
      const decrypted = await symmetricDecrypt({
        key: encryptionKey(),
        data: existing.signingKey.privateJwkEncrypted,
      });
      this.logger.log(`reusing autonomous agent id=${existing.id}`);
      return {
        agentId: existing.id,
        privateJwk: JSON.parse(decrypted) as AgentJWK,
        expiresAt:
          Math.floor(Date.now() / 1000) + DEFAULT_AGENT_SESSION_TTL_SECONDS,
      };
    }

    return this.registerAutonomousAgent();
  }

  private async registerAutonomousAgent(): Promise<AutonomousAgentCredentials> {
    const hostId = await this.ensureGlobalPoolHost();

    const host = await this.prisma.agentHost.findUnique({
      where: { id: hostId },
      include: { signingKey: true },
    });
    if (!host?.signingKey || !host.publicKey) {
      throw new Error(
        `agent-auth-bridge: pool host ${hostId} missing required fields`,
      );
    }

    const decryptedHostPriv = await symmetricDecrypt({
      key: encryptionKey(),
      data: host.signingKey.privateJwkEncrypted,
    });
    const hostPrivJwk = JSON.parse(decryptedHostPriv) as AgentJWK;
    const hostPubJwk = JSON.parse(host.publicKey) as AgentJWK;

    const agentKeypair = await generateKeypair();

    const hostJwt = await signHostJWT({
      hostKeypair: { publicKey: hostPubJwk, privateKey: hostPrivJwk },
      // Use DB integer id as issuer so the plugin can locate the pre-created
      // agentHost row. Without this the SDK defaults to the JWK thumbprint
      // (a string), which fails the plugin's numeric-id lookup.
      issuer: String(host.id),
      audience: authBaseUrl(),
      agentPublicKey: agentKeypair.publicKey,
      hostName: host.name ?? undefined,
    });

    const result = await agentAuthApi().register({
      body: {
        name: ZUKO_AGENT_NAME,
        capabilities: AGENT_CAPABILITIES,
        mode: 'autonomous',
      },
      headers: new Headers({ Authorization: `Bearer ${hostJwt}` }),
    });

    if (result.status !== 'active') {
      throw new Error(
        `agent-auth-bridge: register returned status="${result.status}"; expected "active". agentId=${result.agent_id}`,
      );
    }

    const agentIdInt = Number.parseInt(result.agent_id, 10);
    if (!Number.isFinite(agentIdInt)) {
      throw new Error(
        `agent-auth-bridge: register returned non-numeric agent_id "${result.agent_id}"`,
      );
    }

    const encryptedAgentPriv = await symmetricEncrypt({
      key: encryptionKey(),
      data: JSON.stringify(agentKeypair.privateKey),
    });
    await this.prisma.agentSigningKey.create({
      data: { agentId: agentIdInt, privateJwkEncrypted: encryptedAgentPriv },
    });

    this.logger.log(`registered autonomous agent id=${agentIdInt}`);
    return {
      agentId: agentIdInt,
      privateJwk: agentKeypair.privateKey,
      expiresAt:
        Math.floor(Date.now() / 1000) + DEFAULT_AGENT_SESSION_TTL_SECONDS,
    };
  }

  /**
   * Ensure a per-user AgentHost exists (used to vouch for delegated agents).
   * One host per user — idempotent.
   */
  async ensureUserHost(userId: number): Promise<number> {
    const existing = await this.prisma.agentHost.findFirst({
      where: { userId, status: 'active' },
      select: {
        id: true,
        publicKey: true,
        signingKey: { select: { id: true } },
      },
    });

    if (existing?.publicKey && existing.signingKey) {
      return existing.id;
    }

    const keypair = await generateKeypair();
    const encryptedPrivJwk = await symmetricEncrypt({
      key: encryptionKey(),
      data: JSON.stringify(keypair.privateKey),
    });

    const host = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.agentHost.update({
          where: { id: existing.id },
          data: {
            publicKey: JSON.stringify(keypair.publicKey),
            kid: keypair.publicKey.kid ?? null,
            defaultCapabilities: JSON.stringify(AGENT_CAPABILITIES),
            activatedAt: new Date(),
          },
        });
        await tx.hostSigningKey.upsert({
          where: { agentHostId: existing.id },
          update: {
            privateJwkEncrypted: encryptedPrivJwk,
            rotatedAt: new Date(),
          },
          create: {
            agentHostId: existing.id,
            privateJwkEncrypted: encryptedPrivJwk,
          },
        });
        return { id: existing.id };
      }

      const created = await tx.agentHost.create({
        data: {
          userId,
          name: `user-host-${userId}`,
          publicKey: JSON.stringify(keypair.publicKey),
          kid: keypair.publicKey.kid ?? null,
          defaultCapabilities: JSON.stringify(AGENT_CAPABILITIES),
          status: 'active',
          activatedAt: new Date(),
        },
        select: { id: true },
      });
      await tx.hostSigningKey.create({
        data: {
          agentHostId: created.id,
          privateJwkEncrypted: encryptedPrivJwk,
        },
      });
      return created;
    });

    this.logger.log(`created user host id=${host.id} for userId=${userId}`);
    return host.id;
  }

  /**
   * Register a delegated agent for a specific chat and user.
   * The agent inherits all capabilities by default (matching Gather's approach).
   * Returns agentId and the granted capabilities list.
   */
  async registerDelegatedAgent(args: {
    userId: number;
    chatId: number;
    capabilities?: string[];
  }): Promise<DelegatedAgentCredentials> {
    const capabilities = args.capabilities ?? AGENT_CAPABILITIES;
    const hostId = await this.ensureUserHost(args.userId);

    const host = await this.prisma.agentHost.findUnique({
      where: { id: hostId },
      include: { signingKey: true },
    });
    if (!host?.signingKey || !host.publicKey) {
      throw new Error(
        `agent-auth-bridge: user host ${hostId} missing required fields`,
      );
    }

    const decryptedHostPriv = await symmetricDecrypt({
      key: encryptionKey(),
      data: host.signingKey.privateJwkEncrypted,
    });
    const hostPrivJwk = JSON.parse(decryptedHostPriv) as AgentJWK;
    const hostPubJwk = JSON.parse(host.publicKey) as AgentJWK;

    const agentKeypair = await generateKeypair();

    const hostJwt = await signHostJWT({
      hostKeypair: { publicKey: hostPubJwk, privateKey: hostPrivJwk },
      issuer: String(host.id),
      audience: authBaseUrl(),
      agentPublicKey: agentKeypair.publicKey,
      hostName: host.name ?? undefined,
    });

    const result = await agentAuthApi().register({
      body: {
        name: `chat-agent-${args.chatId}`,
        capabilities,
        mode: 'delegated',
      },
      headers: new Headers({ Authorization: `Bearer ${hostJwt}` }),
    });

    if (result.status !== 'active') {
      throw new Error(
        `agent-auth-bridge: register returned status="${result.status}"; expected "active". agentId=${result.agent_id}`,
      );
    }

    const agentIdInt = Number.parseInt(result.agent_id, 10);
    if (!Number.isFinite(agentIdInt)) {
      throw new Error(
        `agent-auth-bridge: register returned non-numeric agent_id "${result.agent_id}"`,
      );
    }

    const encryptedAgentPriv = await symmetricEncrypt({
      key: encryptionKey(),
      data: JSON.stringify(agentKeypair.privateKey),
    });
    await this.prisma.agentSigningKey.create({
      data: { agentId: agentIdInt, privateJwkEncrypted: encryptedAgentPriv },
    });

    this.logger.log(
      `registered delegated agent id=${agentIdInt} for chatId=${args.chatId} userId=${args.userId}`,
    );
    return { agentId: agentIdInt, capabilities };
  }

  /**
   * Sign a short-lived JWT scoped to the given capabilities using the
   * agent's persisted private key. Loads + decrypts the key from DB on
   * each call — no in-memory key storage needed.
   */
  async signAgentJWT(args: {
    agentId: number;
    capabilities: string[];
    expiresInSeconds?: number;
  }): Promise<string> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: args.agentId },
      include: { signingKey: true },
    });
    if (!agent) {
      throw new Error(`agent-auth-bridge: agent ${args.agentId} not found`);
    }
    if (agent.status !== 'active') {
      throw new Error(
        `agent-auth-bridge: agent ${args.agentId} status="${agent.status}", cannot sign JWT`,
      );
    }
    if (!agent.signingKey) {
      throw new Error(
        `agent-auth-bridge: agent ${args.agentId} has no signing key`,
      );
    }

    const decrypted = await symmetricDecrypt({
      key: encryptionKey(),
      data: agent.signingKey.privateJwkEncrypted,
    });
    const privKey = JSON.parse(decrypted) as AgentJWK;
    const pubKey = JSON.parse(agent.publicKey) as AgentJWK;

    return signAgentJwtRaw({
      agentKeypair: { publicKey: pubKey, privateKey: privKey },
      agentId: String(args.agentId),
      audience: authBaseUrl(),
      capabilities: args.capabilities,
      expiresInSeconds: args.expiresInSeconds ?? 60,
    });
  }

  async revokeAgent(agentId: string | number): Promise<void> {
    const numericId =
      typeof agentId === 'number' ? agentId : Number.parseInt(agentId, 10);
    if (!Number.isFinite(numericId)) {
      this.logger.warn(
        `revokeAgent: non-numeric agentId, skipping: ${agentId}`,
      );
      return;
    }
    await this.prisma.agent
      .update({ where: { id: numericId }, data: { status: 'revoked' } })
      .catch((err: Error) => {
        this.logger.warn(`revokeAgent(${agentId}) skipped: ${err.message}`);
      });
  }
}
