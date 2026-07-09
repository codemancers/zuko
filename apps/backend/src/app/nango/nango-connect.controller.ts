import {
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';
import type { RequestWithUser } from '@zuko/core';
import { NangoService } from './nango.service';

/**
 * Integrations a browser session is allowed to initiate OAuth for.
 * Deliberately server-controlled — never accept this from the request
 * body, otherwise any authenticated user could mint connect sessions
 * for arbitrary providers.
 */
const ALLOWED_INTEGRATIONS = ['apollo-oauth'] as const;

@ApiTags('Nango')
@ApiBearerAuth('session')
@Controller('nango')
export class NangoConnectController {
  constructor(private readonly nangoService: NangoService) {}

  @Post('session')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiOperation({ summary: 'Create a Nango connect session token' })
  @ApiResponse({ status: 200, description: 'Session token created' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 502,
    description: 'Nango session could not be created',
  })
  async createSession(
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
  ) {
    const sessionToken = await this.nangoService.createConnectSession(
      req.user.id,
      String(organizationId),
      [...ALLOWED_INTEGRATIONS],
    );
    return { sessionToken };
  }
}
