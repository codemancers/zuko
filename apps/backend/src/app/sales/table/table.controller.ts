import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { TableService } from './table.service';
import { OrgId } from '../../../common/auth/org-id.decorator';
import { OrganizationGuard } from '../../../common/auth/organization.guard';
import { CompanyListQueryDto } from '../companies.controller';
import { ContactListQueryDto } from '../contacts.controller';
import { DealListQueryDto } from '../deals.controller';

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

  @Patch(':entity/:rowId/cell')
  async updateCell(
    @Param('entity') entity: string,
    @Param('rowId') rowId: number,
    @Body() dto: UpdateCellDto,
  ) {
    return this.tableService.updateCell(entity, rowId, dto);
  }
}
