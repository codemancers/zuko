import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import {
  CompaniesService,
  ContactsService,
  DealsService,
  COMPANY_TABLE_METADATA,
  CONTACT_TABLE_METADATA,
  DEAL_TABLE_METADATA,
  TableViewCompany,
  TableViewContact,
  TableViewDeal,
} from '@zuko/sales';
import { ViewsService } from './views.service';
import { CompanyListQueryDto } from './companies.controller';
import { ContactListQueryDto } from './contacts.controller';
import { DealListQueryDto } from './deals.controller';
import { OrgId } from '../../common/auth/org-id.decorator';
import { OrganizationGuard } from '../../common/auth/organization.guard';

@Controller('views')
@UseGuards(AuthGuard, OrganizationGuard)
export class ViewsController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly contactsService: ContactsService,
    private readonly dealsService: DealsService,
    private readonly viewsService: ViewsService,
  ) {}

  @Get('companies')
  async getCompaniesTable(
    @OrgId() organizationId: number,
    @Query() query: CompanyListQueryDto
  ) {
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

    return this.viewsService.buildTableView<TableViewCompany>(
      result.companies,
      COMPANY_TABLE_METADATA,
      result.pagination,
    );
  }

  @Get('contacts')
  async getContactsTable(
    @OrgId() organizationId: number,
    @Query() query: ContactListQueryDto
  ) {
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

    return this.viewsService.buildTableView<TableViewContact>(
      result.contacts,
      CONTACT_TABLE_METADATA,
      result.pagination,
    );
  }

  @Get('deals')
  async getDealsTable(
    @OrgId() organizationId: number,
    @Query() query: DealListQueryDto
  ) {
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

    return this.viewsService.buildTableView<TableViewDeal>(
      result.deals,
      DEAL_TABLE_METADATA,
      result.pagination,
    );
  }
}
