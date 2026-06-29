import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../../../common/auth/organization.guard';
import { OrgId } from '../../../../common/auth/org-id.decorator';
import { UserId } from '../../../../common/auth/user-id.decorator';
import { ApolloSequencesService } from './apollo-sequences.service';
import {
  CreateSequenceDto,
  AddContactsToSequenceDto,
  SearchSequencesDto,
  CreateCampaignDto,
  SaveSequenceDto,
} from './dto/sequences.dto';

@ApiTags('Apollo Sequences')
@ApiBearerAuth('session')
@UseGuards(AuthGuard, OrganizationGuard)
@Controller('integrations/apollo/sequences')
export class ApolloSequencesController {
  constructor(
    private readonly apolloSequencesService: ApolloSequencesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List Apollo sequences for the organisation' })
  @ApiOkResponse({ description: 'Paginated list of Apollo sequences' })
  search(@OrgId() organizationId: number, @Query() dto: SearchSequencesDto) {
    return this.apolloSequencesService.searchSequences(organizationId, dto);
  }

  @Get('schedules')
  @ApiOperation({ summary: 'List Apollo sending schedules' })
  @ApiOkResponse({ description: 'List of sending schedules' })
  schedules(@OrgId() organizationId: number) {
    return this.apolloSequencesService.getSchedules(organizationId);
  }

  @Get(':id/campaign')
  @ApiOperation({ summary: 'Get Zuko campaign record for a sequence' })
  @ApiOkResponse({ description: 'Zuko campaign record' })
  getCampaign(@OrgId() organizationId: number, @Param('id') id: string) {
    return this.apolloSequencesService.getCampaign(organizationId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Apollo sequence' })
  @ApiCreatedResponse({ description: 'Apollo sequence created' })
  create(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Body() dto: CreateSequenceDto,
  ) {
    return this.apolloSequencesService.createSequence(
      organizationId,
      userId,
      dto,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing Apollo sequence' })
  @ApiOkResponse({ description: 'Apollo sequence updated' })
  update(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Param('id') id: string,
    @Body() dto: CreateSequenceDto,
  ) {
    return this.apolloSequencesService.updateSequence(
      organizationId,
      id,
      userId,
      dto,
    );
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Activate an Apollo sequence' })
  @ApiOkResponse({ description: 'Sequence activated' })
  approve(@OrgId() organizationId: number, @Param('id') id: string) {
    return this.apolloSequencesService.approveSequence(organizationId, id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate an Apollo sequence' })
  @ApiOkResponse({ description: 'Sequence deactivated' })
  deactivate(@OrgId() organizationId: number, @Param('id') id: string) {
    return this.apolloSequencesService.deactivateSequence(organizationId, id);
  }

  @Post('contacts')
  @ApiOperation({ summary: 'Add contacts to an Apollo sequence' })
  @ApiOkResponse({ description: 'Contacts enrolled in sequence' })
  addContacts(
    @OrgId() organizationId: number,
    @Body() dto: AddContactsToSequenceDto,
  ) {
    return this.apolloSequencesService.addContactsToSequence(
      organizationId,
      dto,
    );
  }

  @Post('campaigns')
  @ApiOperation({
    summary: 'Create a campaign record (name only, no Apollo sequence yet)',
  })
  @ApiCreatedResponse({ description: 'Campaign record created' })
  createCampaignMeta(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.apolloSequencesService.createCampaignMeta(
      organizationId,
      userId,
      dto,
    );
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Get a Zuko campaign by its DB id' })
  @ApiOkResponse({ description: 'Zuko campaign record' })
  getCampaignByDbId(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.apolloSequencesService.getZukoCampaignById(organizationId, id);
  }

  @Post('campaigns/:id/sequence')
  @ApiOperation({
    summary: 'Create or update the Apollo sequence for a campaign',
  })
  @ApiOkResponse({ description: 'Sequence saved and linked to campaign' })
  saveSequence(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveSequenceDto,
  ) {
    return this.apolloSequencesService.saveSequenceForCampaign(
      organizationId,
      id,
      userId,
      dto,
    );
  }
}
