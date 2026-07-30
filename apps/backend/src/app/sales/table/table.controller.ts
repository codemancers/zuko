import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { TableService } from './table.service';
import { OrgId } from '../../../common/auth/org-id.decorator';
import { OrganizationGuard } from '../../../common/auth/organization.guard';
import type { CompanyListQueryDto } from '../companies.controller';
import type { ContactListQueryDto } from '../contacts.controller';
import type { DealListQueryDto } from '../deals.controller';
import type { ColumnConfig, ColumnType } from '@zuko/sales';
import type { RequestWithUser } from '@zuko/core';

export class CreateColumnDto {
  @ApiProperty({ example: 'Industry' })
  label!: string;

  @ApiProperty({ example: 'industry' })
  columnKey!: string;

  @ApiProperty({ example: 'text', description: 'Column field type' })
  fieldType!: ColumnType;

  @ApiPropertyOptional({
    type: Object,
    description: 'Column configuration options',
  })
  config?: ColumnConfig;

  @ApiPropertyOptional({ type: Boolean })
  isRequired?: boolean;
}

export class UpdateCellDto {
  @ApiProperty({ description: 'Column ID to update' })
  columnId!: string;

  @ApiProperty({ type: Object, description: 'New cell value' })
  value!: unknown;
}

@ApiTags('Table Views')
@ApiBearerAuth('session')
@Controller('tables')
@UseGuards(AuthGuard, OrganizationGuard)
export class TableController {
  constructor(private readonly tableService: TableService) {}

  @Get('companies')
  @ApiOperation({ summary: 'Get companies table view with custom columns' })
  @ApiResponse({ status: 200, description: 'Companies table data' })
  async getCompaniesTable(
    @OrgId() organizationId: number,
    @Query() query: CompanyListQueryDto,
  ) {
    return this.tableService.getCompaniesTable(organizationId, query);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Get contacts table view with custom columns' })
  @ApiResponse({ status: 200, description: 'Contacts table data' })
  async getContactsTable(
    @OrgId() organizationId: number,
    @Query() query: ContactListQueryDto,
  ) {
    return this.tableService.getContactsTable(organizationId, query);
  }

  @Get('deals')
  @ApiOperation({ summary: 'Get deals table view with custom columns' })
  @ApiResponse({ status: 200, description: 'Deals table data' })
  async getDealsTable(
    @OrgId() organizationId: number,
    @Query() query: DealListQueryDto,
  ) {
    return this.tableService.getDealsTable(organizationId, query);
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Get tasks table view' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Tasks table data' })
  async getTasksTable(
    @OrgId() organizationId: number,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.tableService.getTasksTable(organizationId, search, page, limit);
  }

  @Get('meetings')
  @ApiOperation({ summary: 'Get meetings table view' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Meetings table data' })
  async getMeetingsTable(
    @OrgId() organizationId: number,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.tableService.getMeetingsTable(
      organizationId,
      search,
      page,
      limit,
    );
  }

  @Get('leads')
  @ApiOperation({ summary: 'Get leads table view' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Leads table data' })
  async getLeadsTable(
    @OrgId() organizationId: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
  ) {
    return this.tableService.getLeadsTable(
      organizationId,
      search,
      status,
      page,
      limit,
    );
  }

  @Post(':entity/columns')
  @ApiOperation({ summary: 'Create a custom column for an entity table' })
  @ApiParam({
    name: 'entity',
    type: String,
    enum: ['companies', 'contacts', 'deals', 'tasks', 'meetings'],
  })
  @ApiResponse({ status: 201, description: 'Column created' })
  async createColumn(
    @Param('entity') entity: string,
    @OrgId() organizationId: number,
    @Req() req: RequestWithUser,
    @Body() dto: CreateColumnDto,
  ) {
    return this.tableService.createColumn(
      entity,
      organizationId,
      parseInt(req.user.id, 10),
      dto,
    );
  }

  @Patch(':entity/:rowId/cell')
  @ApiOperation({ summary: 'Update a cell value in a table row' })
  @ApiParam({
    name: 'entity',
    type: String,
    enum: ['companies', 'contacts', 'deals', 'tasks', 'meetings'],
  })
  @ApiParam({ name: 'rowId', type: Number })
  @ApiResponse({ status: 200, description: 'Cell updated' })
  async updateCell(
    @Param('entity') entity: string,
    @Param('rowId', ParseIntPipe) rowId: number,
    @OrgId() organizationId: number,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateCellDto,
  ) {
    const actorId = parseInt(req.user.id, 10);
    return this.tableService.updateCell(
      entity,
      rowId,
      organizationId,
      actorId,
      dto,
    );
  }
}
