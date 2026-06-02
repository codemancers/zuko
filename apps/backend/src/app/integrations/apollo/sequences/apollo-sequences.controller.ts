import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../../../common/auth/organization.guard';
import { OrgId } from '../../../../common/auth/org-id.decorator';
import { ApolloSequencesService } from './apollo-sequences.service';
import {
  CreateSequenceDto,
  AddContactsToSequenceDto,
  SearchSequencesDto,
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
  search(@OrgId() organizationId: number, @Query() dto: SearchSequencesDto) {
    return this.apolloSequencesService.searchSequences(organizationId, dto);
  }

  @Get('schedules')
  @ApiOperation({ summary: 'List Apollo sending schedules' })
  schedules(@OrgId() organizationId: number) {
    return this.apolloSequencesService.getSchedules(organizationId);
  }

  @Get(':id/campaign')
  @ApiOperation({ summary: 'Get Zuko campaign record for a sequence' })
  getCampaign(@OrgId() organizationId: number, @Param('id') id: string) {
    return this.apolloSequencesService.getCampaign(organizationId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Apollo sequence' })
  create(
    @OrgId() organizationId: number,
    @Request() req: any,
    @Body() dto: CreateSequenceDto,
  ) {
    const userId = parseInt(req.user?.id ?? req.session?.user?.id ?? '0', 10);
    return this.apolloSequencesService.createSequence(
      organizationId,
      userId,
      dto,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing Apollo sequence' })
  update(
    @OrgId() organizationId: number,
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateSequenceDto,
  ) {
    const userId = parseInt(req.user?.id ?? req.session?.user?.id ?? '0', 10);
    return this.apolloSequencesService.updateSequence(
      organizationId,
      id,
      userId,
      dto,
    );
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Activate an Apollo sequence' })
  approve(@OrgId() organizationId: number, @Param('id') id: string) {
    return this.apolloSequencesService.approveSequence(organizationId, id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate an Apollo sequence' })
  deactivate(@OrgId() organizationId: number, @Param('id') id: string) {
    return this.apolloSequencesService.deactivateSequence(organizationId, id);
  }

  @Post('contacts')
  @ApiOperation({ summary: 'Add contacts to an Apollo sequence' })
  addContacts(
    @OrgId() organizationId: number,
    @Body() dto: AddContactsToSequenceDto,
  ) {
    return this.apolloSequencesService.addContactsToSequence(
      organizationId,
      dto,
    );
  }
}
