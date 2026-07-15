import {
  BadRequestException,
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { AccountsService } from '../accounts/accounts.service';
import {
  EvePrincipalGuard,
  type EvePrincipalContext,
} from './eve-principal.guard';

/**
 * Internal endpoint the eve agent calls to get the session user's Claude OAuth.
 * Route: GET /api/internal/eve/claude-oauth
 * Auth: EvePrincipalGuard (Authorization: EvePrincipal <token>); global
 * AppAuthGuard bypassed via @AllowAnonymous().
 */
@AllowAnonymous()
@UseGuards(EvePrincipalGuard)
@Controller('internal/eve')
export class EveCredentialsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('claude-oauth')
  async claudeOauth(
    @Req() req: Request & { evePrincipal: EvePrincipalContext },
  ) {
    try {
      return await this.accountsService.getValidClaudeOauth(
        req.evePrincipal.userId,
      );
    } catch (err) {
      // getValidClaudeOauth throws two distinct shapes (see
      // get-valid-claude-oauth.ts): an actionable "not connected" /
      // "reconnect under Settings" error the client can act on (→ 400), or a
      // transient upstream failure (Anthropic unreachable, network error,
      // etc.) that's retryable and should surface as a 5xx, not a 400.
      if (isActionable(err)) {
        throw new BadRequestException(
          err instanceof Error ? err.message : String(err),
        );
      }
      throw err;
    }
  }
}

/**
 * Both actionable errors thrown by getValidClaudeOauthWithStore reference
 * connecting/reconnecting "under Settings" — that's the signal the client
 * should act rather than retry.
 */
function isActionable(err: unknown): boolean {
  return err instanceof Error && err.message.includes('under Settings.');
}
