import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { RequestWithOrganization } from '@zuko/core';
import { auth } from '../../libs/better-auth/auth';
import type { AgentAuthApi } from '../../agent-auth-api';

const AGENT_ORG_ID_HEADER = 'x-org-id';

/**
 * Guard for /api/agents routes. Validates the agent JWT issued by the
 * better-auth agent-auth plugin and sets request.organizationId from the
 * x-org-id header so @OrgId() works without a user session.
 */
@Injectable()
export class AgentGuard implements CanActivate {
  private readonly logger = new Logger(AgentGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithOrganization>();

    const authorization = request.headers['authorization'];
    if (!authorization?.startsWith('Bearer ')) {
      this.logger.warn('Agent request rejected: missing Bearer token');
      return false;
    }

    const headers = new Headers({ authorization });
    const agentSession = await (
      auth as unknown as { api: AgentAuthApi }
    ).api.getAgentSession({ headers });

    if (!agentSession) {
      this.logger.warn('Agent request rejected: invalid or expired agent JWT');
      return false;
    }

    const value = request.headers[AGENT_ORG_ID_HEADER];
    if (value === undefined || value === '') {
      throw new BadRequestException(
        'Missing or empty x-org-id header; organisationId is required for this route',
      );
    }
    const id =
      typeof value === 'string' ? parseInt(String(value).trim(), 10) : NaN;
    if (Number.isNaN(id) || id < 1) {
      throw new BadRequestException(
        'Invalid x-org-id header; must be a positive number',
      );
    }

    request.organizationId = id;
    return true;
  }
}
