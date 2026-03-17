import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { RequestWithOrganization } from '@zuko/core';

/** Header sent by ai-agents Backend() when calling /api/agents */
const AGENT_ORG_ID_HEADER = 'x-org-id';
const AGENT_TOKEN_HEADER = 'x-agent-token';

/**
 * Guard for /api/agents routes. Validates x-agent-token and sets request.organizationId
 * from x-org-id so @OrgId() works without session (no AuthGuard/OrganizationGuard).
 */
@Injectable()
export class AgentGuard implements CanActivate {
  private readonly logger = new Logger(AgentGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithOrganization>();

    const token = request.headers[AGENT_TOKEN_HEADER];
    const expectedToken = process.env.AGENT_TOKEN;
    if (!expectedToken || token !== expectedToken) {
      this.logger.warn('Agent request rejected: invalid or missing x-agent-token');
      return false;
    }

    const value = request.headers[AGENT_ORG_ID_HEADER];
    if (value === undefined || value === '') {
      throw new BadRequestException(
        'Missing or empty x-org-id header; organisationId is required for this route',
      );
    }
    const id = typeof value === 'string' ? parseInt(String(value).trim(), 10) : NaN;
    if (Number.isNaN(id) || id < 1) {
      throw new BadRequestException(
        'Invalid x-org-id header; must be a positive number',
      );
    }

    request.organizationId = id;
    return true;
  }
}
