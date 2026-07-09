import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';
import type { RequestWithUser } from '@zuko/core';
import { NangoService } from './nango.service';

class CreateSessionDto {
  allowedIntegrations?: string[];
}

@ApiTags('Nango')
@ApiBearerAuth('session')
@Controller('nango')
export class NangoConnectController {
  constructor(private readonly nangoService: NangoService) {}

  @Post('session')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiOperation({ summary: 'Create a Nango connect session token' })
  async createSession(
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
    @Body() body: CreateSessionDto,
  ) {
    const sessionToken = await this.nangoService.createConnectSession(
      req.user.id,
      String(organizationId),
      body.allowedIntegrations,
    );
    const connectionId = `org-${organizationId}`;
    return { sessionToken, connectionId };
  }
}
