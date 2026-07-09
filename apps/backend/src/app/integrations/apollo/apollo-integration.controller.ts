import {
  Controller,
  Get,
  Post,
  Delete,
  Req,
  Body,
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

  @Post('activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiOperation({
    summary:
      'Record Apollo connection after Nango OAuth completes on the frontend',
  })
  @ApiResponse({ status: 204, description: 'Connection recorded' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async activate(
    @OrgId() organizationId: number,
    @Req() req: RequestWithUser,
    @Body() body: { nangoConnectionId: string },
  ) {
    const userId = parseInt(req.user.id, 10);
    this.logger.log(
      `[POST_APOLLO_ACTIVATE] Recording connection for organizationId=${organizationId}`,
    );
    await this.apolloIntegrationService.recordConnection(
      organizationId,
      userId,
      body.nangoConnectionId,
    );
  }

  @Get('usage-stats')
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiOperation({ summary: 'Get Apollo API usage stats for the organisation' })
  @ApiResponse({ status: 200, description: 'API usage stats' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getUsageStats(@OrgId() organizationId: number) {
    return this.apolloIntegrationService.getUsageStats(organizationId);
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
