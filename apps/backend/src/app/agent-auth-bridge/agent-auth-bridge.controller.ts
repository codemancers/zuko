import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { AgentAuthBridgeService } from './agent-auth-bridge.service';

/**
 * Internal HTTP surface for agent identity initialization and JWT signing.
 *
 * Protected by a shared secret passed in the x-internal-secret header.
 * In production this service is on a private network — the header check
 * is a second line of defence, not the only one.
 */
@Controller('agent-auth')
export class AgentAuthBridgeController {
  constructor(private readonly bridge: AgentAuthBridgeService) {}

  private checkSecret(secret: string | undefined) {
    const expected =
      process.env.AGENT_INTERNAL_SECRET ||
      process.env.BETTER_AUTH_SECRET ||
      process.env.AUTH_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid or missing x-internal-secret');
    }
  }

  /**
   * Called once on startup (or lazily). Returns the agent's id and
   * decrypted private JWK so callers can sign JWTs locally without
   * further round-trips. Idempotent — reuses existing agent row.
   */
  @Post('init')
  @HttpCode(200)
  async init(@Headers('x-internal-secret') secret: string | undefined) {
    this.checkSecret(secret);
    const { agentId, privateJwk, expiresAt } =
      await this.bridge.ensureAutonomousAgent();
    return { agentId, privateJwk, expiresAt };
  }

  /**
   * Sign a short-lived JWT for the given capabilities. Use this if
   * the caller prefers not to hold the private key in memory.
   */
  @Post('sign')
  @HttpCode(200)
  async sign(
    @Headers('x-internal-secret') secret: string | undefined,
    @Body() body: {
      agentId: number;
      capabilities?: string[];
      expiresInSeconds?: number;
    },
  ) {
    this.checkSecret(secret);
    const token = await this.bridge.signAgentJWT({
      agentId: body.agentId,
      capabilities: body.capabilities ?? [],
      expiresInSeconds: body.expiresInSeconds,
    });
    return { token };
  }
}
