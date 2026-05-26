import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../../common/auth/organization.guard';
import { OrgId } from '../../../common/auth/org-id.decorator';
import type { RequestWithUser } from '@zuko/core';
import { ApolloIntegrationService } from './apollo-integration.service';
import { ExchangeApolloCodeDto } from './dto/apollo.dto';

@ApiTags('Integrations')
@ApiBearerAuth('session')
@Controller('integrations/apollo')
export class ApolloIntegrationController {
  private readonly logger = new Logger(ApolloIntegrationController.name);

  constructor(
    private readonly apolloIntegrationService: ApolloIntegrationService,
  ) {}

  @Get('status')
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiOperation({
    summary: 'Get Apollo connection status for the organisation',
  })
  @ApiResponse({ status: 200, description: 'Connection status' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getConnectionStatus(@OrgId() organizationId: number) {
    return this.apolloIntegrationService.getConnectionStatus(organizationId);
  }

  @Get('authorize')
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiOperation({ summary: 'Get Apollo OAuth authorization URL' })
  @ApiResponse({ status: 200, description: 'Authorization URL' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getAuthorizationUrl(
    @OrgId() organizationId: number,
    @Req() req: RequestWithUser,
  ) {
    const userId = parseInt(req.user.id, 10);
    return this.apolloIntegrationService.buildAuthorizationUrl(
      organizationId,
      userId,
    );
  }

  @Post('exchange')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Exchange Apollo OAuth code for tokens (called by Next.js callback route)',
  })
  @ApiResponse({ status: 204, description: 'Tokens exchanged and stored' })
  @ApiResponse({ status: 400, description: 'Invalid or expired state' })
  async exchange(@Body() body: ExchangeApolloCodeDto) {
    this.logger.log('[POST_APOLLO_EXCHANGE] Exchanging authorization code');
    await this.apolloIntegrationService.exchangeCodeForTokens(
      body.code,
      body.state,
    );
  }

  @Delete('disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiOperation({ summary: 'Disconnect Apollo from the organisation' })
  @ApiResponse({ status: 204, description: 'Disconnected' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async disconnect(@OrgId() organizationId: number) {
    await this.apolloIntegrationService.disconnect(organizationId);
  }
}
