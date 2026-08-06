import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../../../common/auth/organization.guard';
import { OrgId } from '../../../../common/auth/org-id.decorator';
import { ApolloSequencesService } from './apollo-sequences.service';

@ApiTags('Apollo Campaigns')
@ApiBearerAuth('session')
@UseGuards(AuthGuard, OrganizationGuard)
@Controller('integrations/apollo/campaigns')
export class ApolloCampaignsController {
  constructor(
    private readonly apolloSequencesService: ApolloSequencesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all Zuko campaigns with ICP profile' })
  getAllCampaigns(@OrgId() organizationId: number) {
    return this.apolloSequencesService.getAllCampaigns(organizationId);
  }

  @Get(':icpProfileId/campaigns')
  @ApiOperation({ summary: 'List Zuko campaigns linked to an ICP profile' })
  getCampaignsByIcp(
    @OrgId() organizationId: number,
    @Param('icpProfileId', ParseIntPipe) icpProfileId: number,
  ) {
    return this.apolloSequencesService.getCampaignsByIcpProfile(
      organizationId,
      icpProfileId,
    );
  }
}
