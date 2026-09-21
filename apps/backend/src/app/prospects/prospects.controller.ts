import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { ProspectsService } from '@zuko/sales';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';
import { UserId } from '../../common/auth/user-id.decorator';
import {
  CreateProspectDto,
  EnrolProspectDto,
  ListProspectsQueryDto,
  RecordCampaignEventDto,
  RecordOutreachDto,
  SetConsentDto,
  SetDispositionDto,
  SetProspectStatusDto,
  UpdateProspectDto,
} from './dto/prospects.dto';

@ApiTags('Prospects')
@ApiBearerAuth('session')
@Controller('prospects')
@UseGuards(AuthGuard, OrganizationGuard)
export class ProspectsController {
  constructor(private readonly prospects: ProspectsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Prospect counts by status' })
  stats(@OrgId() organizationId: number) {
    return this.prospects.countByStatus(organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'List prospects' })
  findAll(
    @OrgId() organizationId: number,
    @Query() query: ListProspectsQueryDto,
  ) {
    const toArray = (value?: string[] | string) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value];

    return this.prospects.findAll(
      organizationId,
      {
        search: query.search,
        icpProfileId: query.icpProfileId,
        campaignId: query.campaignId,
        status: toArray(query.status),
        source: toArray(query.source),
        engagement: toArray(query.engagement),
      },
      query.page ?? 1,
      query.perPage ?? 50,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a prospect with its campaign history' })
  @ApiParam({ name: 'id', type: Number })
  findById(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.prospects.findById(id, organizationId);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Campaign event history for a prospect' })
  @ApiParam({ name: 'id', type: Number })
  async findEvents(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.prospects.findById(id, organizationId);
    return this.prospects.findEvents(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a prospect, resolving identity against existing records',
  })
  create(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Body() dto: CreateProspectDto,
  ) {
    return this.prospects.create(organizationId, dto, {
      userId,
      source: 'user',
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update prospect details' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProspectDto,
  ) {
    return this.prospects.update(id, organizationId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Apply a prospect status transition' })
  @ApiParam({ name: 'id', type: Number })
  setStatus(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetProspectStatusDto,
  ) {
    return this.prospects.setStatus(id, organizationId, dto.status, {
      manual: dto.manual,
      actor: { userId, source: 'user' },
    });
  }

  @Post(':id/enrol')
  @ApiOperation({ summary: 'Enrol a prospect in a campaign' })
  @ApiParam({ name: 'id', type: Number })
  enrol(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EnrolProspectDto,
  ) {
    return this.prospects.enrol(id, organizationId, dto.campaignId, {
      channel: dto.channel,
      force: dto.force,
      actor: { userId, source: 'user' },
    });
  }

  @Post(':id/outreach')
  @ApiOperation({
    summary: 'Log a touch made outside any campaign (call, one-off email)',
  })
  @ApiParam({ name: 'id', type: Number })
  recordOutreach(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordOutreachDto,
  ) {
    return this.prospects.recordDirectOutreach(
      id,
      organizationId,
      dto.eventType,
      dto.channel,
      { userId, source: 'user' },
    );
  }

  @Post(':id/promote')
  @ApiOperation({ summary: 'Promote an engaged prospect to a lead' })
  @ApiParam({ name: 'id', type: Number })
  promote(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.prospects.promote(id, organizationId, {
      userId,
      source: 'user',
    });
  }

  @Post(':id/suppress')
  @ApiOperation({ summary: 'Suppress a prospect and stop all outbound' })
  @ApiParam({ name: 'id', type: Number })
  suppress(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.prospects.suppress(id, organizationId, {
      userId,
      source: 'user',
    });
  }

  @Patch(':id/consent')
  @ApiOperation({ summary: 'Set per-channel consent' })
  @ApiParam({ name: 'id', type: Number })
  setConsent(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetConsentDto,
  ) {
    return this.prospects.setConsent(
      id,
      organizationId,
      dto.channel,
      dto.consent,
      { userId, source: 'user' },
    );
  }

  @Post('memberships/:membershipId/events')
  @ApiOperation({
    summary: 'Record a campaign event and let derived states follow',
  })
  @ApiParam({ name: 'membershipId', type: Number })
  recordEvent(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Param('membershipId', ParseIntPipe) membershipId: number,
    @Body() dto: RecordCampaignEventDto,
  ) {
    return this.prospects.recordEvent(
      membershipId,
      organizationId,
      dto.eventType,
      dto.payload,
      dto.externalId,
      undefined,
      { userId, source: dto.externalId ? 'provider' : 'user' },
    );
  }

  @Patch('memberships/:membershipId/disposition')
  @ApiOperation({ summary: 'Conclude a campaign membership' })
  @ApiParam({ name: 'membershipId', type: Number })
  setDisposition(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Param('membershipId', ParseIntPipe) membershipId: number,
    @Body() dto: SetDispositionDto,
  ) {
    return this.prospects.setDisposition(
      membershipId,
      organizationId,
      dto.disposition,
      {
        actor: { userId, source: 'user' },
        ...(dto.nextEligibleAt
          ? { nextEligibleAt: new Date(dto.nextEligibleAt) }
          : {}),
      },
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a prospect' })
  @ApiParam({ name: 'id', type: Number })
  async delete(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.prospects.delete(id, organizationId);
  }
}
