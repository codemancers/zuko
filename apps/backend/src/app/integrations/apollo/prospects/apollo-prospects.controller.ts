import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../../../common/auth/organization.guard';
import { OrgId } from '../../../../common/auth/org-id.decorator';
import { ApolloProspectsService } from './apollo-prospects.service';
import { ApolloMcpService } from '../apollo-mcp.service';
import {
  SearchProspectsDto,
  AddPeopleToSequenceDto,
} from './dto/prospects.dto';

@ApiTags('Apollo Prospects')
@ApiBearerAuth('session')
@UseGuards(AuthGuard, OrganizationGuard)
@Controller('integrations/apollo')
export class ApolloProspectsController {
  constructor(
    private readonly apolloProspectsService: ApolloProspectsService,
    private readonly apolloMcpService: ApolloMcpService,
  ) {}

  @Get('prospects/mcp-tools')
  @ApiOperation({ summary: 'Debug: list all available Apollo MCP tools' })
  listMcpTools(@OrgId() orgId: number) {
    return this.apolloMcpService.listTools(orgId);
  }

  @Post('prospects/search')
  @ApiOperation({
    summary: 'Search Apollo people and contacts with focused filters',
  })
  searchPeople(@OrgId() orgId: number, @Body() dto: SearchProspectsDto) {
    return this.apolloProspectsService.searchPeople(orgId, dto);
  }

  @Get('organizations/search')
  @ApiOperation({ summary: 'Autocomplete Apollo organizations by name' })
  @ApiQuery({ name: 'name', required: true, type: String })
  searchOrgs(@OrgId() orgId: number, @Query('name') name: string) {
    return this.apolloProspectsService.searchOrganizations(orgId, name ?? '');
  }

  @Post('prospects/add-to-sequence')
  @ApiOperation({
    summary:
      'Convert raw prospects to Apollo contacts (if needed) then enroll into a sequence',
  })
  addToSequence(@OrgId() orgId: number, @Body() dto: AddPeopleToSequenceDto) {
    return this.apolloProspectsService.addPeopleToSequence(orgId, dto);
  }
}
