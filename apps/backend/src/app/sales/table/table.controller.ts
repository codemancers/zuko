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
  label!: string;
  columnKey!: string;
  fieldType!: ColumnType;
  config?: ColumnConfig;
  isRequired?: boolean;
}

export class UpdateCellDto {
  columnId!: string;
  value!: unknown;
}

@Controller('tables')
@UseGuards(AuthGuard, OrganizationGuard)
export class TableController {
  constructor(private readonly tableService: TableService) {}

  @Get('companies')
  async getCompaniesTable(
    @OrgId() organizationId: number,
    @Query() query: CompanyListQueryDto,
  ) {
    return this.tableService.getCompaniesTable(organizationId, query);
  }

  @Get('contacts')
  async getContactsTable(
    @OrgId() organizationId: number,
    @Query() query: ContactListQueryDto,
  ) {
    return this.tableService.getContactsTable(organizationId, query);
  }

  @Get('deals')
  async getDealsTable(
    @OrgId() organizationId: number,
    @Query() query: DealListQueryDto,
  ) {
    return this.tableService.getDealsTable(organizationId, query);
  }

  @Get('tasks')
  async getTasksTable(
    @OrgId() organizationId: number,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.tableService.getTasksTable(organizationId, search, page, limit);
  }

  @Get('meetings')
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

  @Post(':entity/columns')
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
