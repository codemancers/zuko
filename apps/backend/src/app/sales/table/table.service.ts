import { Injectable } from '@nestjs/common';
import {
  CompaniesService,
  ContactsService,
  DealsService,
  COMPANY_TABLE_METADATA,
  CONTACT_TABLE_METADATA,
  DEAL_TABLE_METADATA,
} from '@zuko/sales';
import { TableRowBuilder } from './row-builder/table-row.builder';
import { CompanyListQueryDto } from '../companies.controller';
import { ContactListQueryDto } from '../contacts.controller';
import { DealListQueryDto } from '../deals.controller';
import { UpdateCellDto } from './table.controller';

@Injectable()
export class TableService {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly contactsService: ContactsService,
    private readonly dealsService: DealsService,
    private readonly rowBuilder: TableRowBuilder,
  ) {}

  async getCompaniesTable(organizationId: number, query: CompanyListQueryDto) {
    const filters = {
      organizationId,
      search: query.search,
      isHidden: query.isHidden === 'true',
      ownerIds: query.ownerIds
        ? query.ownerIds.split(',').map(Number)
        : undefined,
    };

    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    const result = await this.companiesService.findAll(filters, pagination);

    return {
      metadata: COMPANY_TABLE_METADATA,
      data: this.rowBuilder.buildRows(result.companies, COMPANY_TABLE_METADATA),
      pagination: result.pagination,
    };
  }

  async getContactsTable(organizationId: number, query: ContactListQueryDto) {
    const filters = {
      organizationId,
      search: query.search,
      isHidden: query.isHidden === 'true',
      ownerIds: query.ownerIds
        ? query.ownerIds.split(',').map(Number)
        : undefined,
    };

    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    const result = await this.contactsService.findAll(filters, pagination);

    return {
      metadata: CONTACT_TABLE_METADATA,
      data: this.rowBuilder.buildRows(result.contacts, CONTACT_TABLE_METADATA),
      pagination: result.pagination,
    };
  }

  async getDealsTable(organizationId: number, query: DealListQueryDto) {
    const filters = {
      organizationId,
      search: query.search,
      isHidden: query.isHidden === 'true',
      ownerIds: query.ownerIds
        ? query.ownerIds.split(',').map(Number)
        : undefined,
      companyIds: query.companyIds
        ? query.companyIds.split(',').map(Number)
        : undefined,
      contactIds: query.contactIds
        ? query.contactIds.split(',').map(Number)
        : undefined,
      stages: query.stages ? query.stages.split(',') : undefined,
      minValue: query.minValue ? Number(query.minValue) : undefined,
      maxValue: query.maxValue ? Number(query.maxValue) : undefined,
      expectedCloseFrom: query.expectedCloseFrom
        ? new Date(query.expectedCloseFrom)
        : undefined,
      expectedCloseTo: query.expectedCloseTo
        ? new Date(query.expectedCloseTo)
        : undefined,
    };

    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    const result = await this.dealsService.findAll(filters, pagination);

    return {
      metadata: DEAL_TABLE_METADATA,
      data: this.rowBuilder.buildRows(result.deals, DEAL_TABLE_METADATA),
      pagination: result.pagination,
    };
  }

  async updateCell(entity: string, rowId: number, dto: UpdateCellDto) {
    // cell update logic
  }
}
