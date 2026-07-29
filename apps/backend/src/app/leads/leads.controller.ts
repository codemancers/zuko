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
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';
import { LeadsService } from './leads.service';
import {
  CreateLeadDto,
  ListLeadsQueryDto,
  UpdateLeadDto,
} from './dto/leads.dto';

@ApiTags('Leads')
@ApiBearerAuth('session')
@Controller('leads')
@UseGuards(AuthGuard, OrganizationGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List leads' })
  findAll(@OrgId() organizationId: number, @Query() query: ListLeadsQueryDto) {
    return this.leadsService.findAll(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by id' })
  @ApiParam({ name: 'id', type: Number })
  findById(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.leadsService.findById(id, organizationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create lead' })
  create(@OrgId() organizationId: number, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(organizationId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(id, organizationId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete lead' })
  @ApiParam({ name: 'id', type: Number })
  delete(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.leadsService.delete(id, organizationId);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Convert lead to deal' })
  @ApiParam({ name: 'id', type: Number })
  convert(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.leadsService.convert(id, organizationId);
  }
}
