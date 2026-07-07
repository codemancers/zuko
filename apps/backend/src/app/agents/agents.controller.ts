import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { OrgId } from '../../common/auth/org-id.decorator';
import { AgentGuard } from '../../common/auth/agent.guard';
import {
  CompaniesService,
  ContactsService,
  DealsService,
  TaskService,
  TaskStatus,
  ACTIVITY_SOURCES,
} from '@zuko/sales';
import type { EditorData } from '@zuko/sales';

// DTOs for agent API (organizationId from AgentGuard via @OrgId())
class CompanyQueryDto {
  filters?: {
    search?: string;
    ownerId?: number;
    companyIds?: number[];
    hasWebsite?: boolean;
    contactCountMin?: number;
    contactCountMax?: number;
    createdAfter?: string;
    createdBefore?: string;
  };
  aggregation?: 'count' | 'list';
  limit?: number;
}

class CompanyCreateDto {
  companyName!: string;
  website!: string;
  linkedinUrl?: string;
  summary?: EditorData;
  ownerIds!: number[];
  primaryOwnerId?: number;
}

class CompanyUpdateDto {
  companyName?: string;
  website?: string;
  linkedinUrl?: string;
  summary?: EditorData;
  isHidden?: boolean;
  fields?: Record<string, unknown>;
}

class ContactQueryDto {
  filters?: {
    contactIds?: number[];
    ownerId?: number;
    search?: string;
    hasEmail?: boolean;
    createdAfter?: string;
    createdBefore?: string;
  };
  aggregation?: 'count' | 'list';
  groupBy?: 'ownerId';
  limit?: number;
}

class ContactCreateDto {
  name!: string;
  email!: string;
  phone?: string;
  linkedinId?: string;
  notes?: EditorData;
  ownerIds!: number[];
  primaryOwnerId?: number;
}

class ContactUpdateDto {
  name?: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: EditorData;
}

class DealQueryDto {
  filters?: {
    dealIds?: number[];
    ownerId?: number;
    stages?: string[];
    minValue?: number;
    maxValue?: number;
    expectedCloseFrom?: string;
    expectedCloseTo?: string;
    companyId?: number;
    contactId?: number;
    search?: string;
    createdAfter?: string;
    createdBefore?: string;
  };
  aggregation?: 'count' | 'list';
  groupBy?: 'stage' | 'ownerId';
  limit?: number;
}

class DealCreateDto {
  title!: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: string;
  summary?: EditorData;
  expectedCloseDate?: string;
  source?: string;
  priority?: number;
  ownerIds!: number[];
  primaryOwnerId?: number;
}

class DealUpdateDto {
  title?: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: string;
  summary?: EditorData;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  lostReason?: string;
  source?: string;
  priority?: number;
}

const STATUS_MAP: Record<'todo' | 'in_progress' | 'done', TaskStatus> = {
  todo: TaskStatus.TODO,
  in_progress: TaskStatus.IN_PROGRESS,
  done: TaskStatus.DONE,
};

function toTaskStatus(s: 'todo' | 'in_progress' | 'done'): TaskStatus {
  return STATUS_MAP[s];
}

@ApiTags('Agents (Internal)')
@ApiBearerAuth('agent-jwt')
@Controller('agents')
@UseGuards(AgentGuard)
export class AgentsController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly contactsService: ContactsService,
    private readonly dealsService: DealsService,
    private readonly taskService: TaskService,
  ) {}

  // --- Companies ---
  @Get('companies/:id')
  @ApiOperation({ summary: 'Get company by ID (agent)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Company details' })
  async findCompanyById(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.companiesService.findById(id, organizationId);
  }

  @Post('companies/query')
  @ApiOperation({ summary: 'Query companies with filters (agent)' })
  @ApiResponse({ status: 200, description: 'Company query results' })
  async queryCompanies(
    @OrgId() organizationId: number,
    @Body() dto: CompanyQueryDto,
  ) {
    const filters = dto.filters ?? {};
    const limit = Math.min(dto.limit ?? 100, 1000);
    const companyFilters: Parameters<CompaniesService['findAll']>[0] = {
      organizationId,
      search: filters.search,
      ownerIds: filters.ownerId != null ? [filters.ownerId] : undefined,
      companyIds: filters.companyIds,
    };
    const result = await this.companiesService.findAll(companyFilters, {
      limit,
      page: 1,
    });
    let companies = result.companies;

    if (filters.hasWebsite !== undefined) {
      companies = companies.filter((a) =>
        filters.hasWebsite ? !!a.website : !a.website,
      );
    }
    if (filters.createdAfter) {
      const after = new Date(filters.createdAfter);
      companies = companies.filter((c) => new Date(c.createdAt) >= after);
    }
    if (filters.createdBefore) {
      const before = new Date(filters.createdBefore);
      companies = companies.filter((c) => new Date(c.createdAt) <= before);
    }
    if (filters.contactCountMin !== undefined) {
      companies = companies.filter(
        (a) => (a._count?.contacts ?? 0) >= filters.contactCountMin!,
      );
    }
    if (filters.contactCountMax !== undefined) {
      companies = companies.filter(
        (a) => (a._count?.contacts ?? 0) <= filters.contactCountMax!,
      );
    }

    if (dto.aggregation === 'count') {
      return { count: companies.length, filters: dto.filters };
    }
    return {
      companies: companies.slice(0, limit).map((a) => ({
        id: a.id,
        companyName: a.companyName,
        website: a.website,
        contactCount: a._count?.contacts ?? 0,
        createdAt: a.createdAt.toISOString(),
      })),
      count: companies.length,
      filters: dto.filters,
    };
  }

  @Post('companies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a company (agent)' })
  @ApiResponse({ status: 201, description: 'Company created' })
  async createCompany(
    @OrgId() organizationId: number,
    @Body() dto: CompanyCreateDto,
  ) {
    return this.companiesService.create(
      {
        organizationId,
        companyName: dto.companyName,
        website: dto.website,
        linkedinUrl: dto.linkedinUrl,
        summary: dto.summary,
        ownerIds: dto.ownerIds,
        primaryOwnerId: dto.primaryOwnerId,
      },
      undefined,
      ACTIVITY_SOURCES.AI,
    );
  }

  @Patch('companies/:id')
  @ApiOperation({ summary: 'Update a company (agent)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Company updated' })
  async updateCompany(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompanyUpdateDto,
  ) {
    return this.companiesService.update(
      id,
      organizationId,
      dto,
      undefined,
      ACTIVITY_SOURCES.AI,
    );
  }

  // --- Contacts ---
  @Get('contacts/:id')
  @ApiOperation({ summary: 'Get contact by ID (agent)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Contact details' })
  async findContactById(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.contactsService.findById(id, organizationId);
  }

  @Post('contacts/query')
  @ApiOperation({ summary: 'Query contacts with filters (agent)' })
  @ApiResponse({ status: 200, description: 'Contact query results' })
  async queryContacts(
    @OrgId() organizationId: number,
    @Body() dto: ContactQueryDto,
  ) {
    const filters = dto.filters ?? {};
    const limit = Math.min(dto.limit ?? 100, 1000);
    const contactFilters: Parameters<ContactsService['findAll']>[0] = {
      organizationId,
      search: filters.search,
      ownerIds: filters.ownerId != null ? [filters.ownerId] : undefined,
      contactIds: filters.contactIds,
    };
    const result = await this.contactsService.findAll(contactFilters, {
      limit,
      page: 1,
    });
    let contacts = result.contacts;

    if (filters.createdAfter) {
      const after = new Date(filters.createdAfter);
      contacts = contacts.filter((c) => new Date(c.createdAt) >= after);
    }
    if (filters.createdBefore) {
      const before = new Date(filters.createdBefore);
      contacts = contacts.filter((c) => new Date(c.createdAt) <= before);
    }
    if (filters.hasEmail !== undefined) {
      contacts = contacts.filter((c) =>
        filters.hasEmail ? !!c.email : !c.email,
      );
    }

    if (dto.aggregation === 'count') {
      return { count: contacts.length, filters: dto.filters };
    }
    if (dto.groupBy === 'ownerId') {
      const grouped: Record<string, unknown[]> = {};
      for (const c of contacts) {
        const key =
          (c.owners?.[0] as { userId?: number })?.userId?.toString() ??
          'no-owner';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({
          id: c.id,
          name: c.name,
          email: c.email,
          createdAt: c.createdAt.toISOString(),
        });
      }
      return {
        grouped,
        totalCount: contacts.length,
        groupCount: Object.keys(grouped).length,
      };
    }
    return {
      contacts: contacts.slice(0, limit).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        createdAt: c.createdAt.toISOString(),
        ownerCount: c.owners?.length ?? 0,
      })),
      count: contacts.length,
      filters: dto.filters,
    };
  }

  @Post('contacts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a contact (agent)' })
  @ApiResponse({ status: 201, description: 'Contact created' })
  async createContact(
    @OrgId() organizationId: number,
    @Body() dto: ContactCreateDto,
  ) {
    return this.contactsService.create(
      {
        organizationId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        linkedinId: dto.linkedinId,
        notes: dto.notes,
        ownerIds: dto.ownerIds,
        primaryOwnerId: dto.primaryOwnerId,
      },
      undefined,
      ACTIVITY_SOURCES.AI,
    );
  }

  @Patch('contacts/:id')
  @ApiOperation({ summary: 'Update a contact (agent)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Contact updated' })
  async updateContact(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ContactUpdateDto,
  ) {
    return this.contactsService.update(
      id,
      organizationId,
      dto,
      undefined,
      ACTIVITY_SOURCES.AI,
    );
  }

  // --- Deals ---
  @Get('deals/:id')
  @ApiOperation({ summary: 'Get deal by ID (agent)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Deal details' })
  async findDealById(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dealsService.findById(id, organizationId);
  }

  @Post('deals/query')
  @ApiOperation({ summary: 'Query deals with filters (agent)' })
  @ApiResponse({ status: 200, description: 'Deal query results' })
  async queryDeals(@OrgId() organizationId: number, @Body() dto: DealQueryDto) {
    const filters = dto.filters ?? {};
    const limit = Math.min(dto.limit ?? 100, 1000);
    const dealFilters: Parameters<DealsService['findAll']>[0] = {
      organizationId,
      search: filters.search,
      ownerIds: filters.ownerId != null ? [filters.ownerId] : undefined,
      dealIds: filters.dealIds,
      stages: filters.stages,
      minValue: filters.minValue,
      maxValue: filters.maxValue,
      expectedCloseFrom: filters.expectedCloseFrom
        ? new Date(filters.expectedCloseFrom)
        : undefined,
      expectedCloseTo: filters.expectedCloseTo
        ? new Date(filters.expectedCloseTo)
        : undefined,
      companyIds: filters.companyId != null ? [filters.companyId] : undefined,
      contactIds: filters.contactId != null ? [filters.contactId] : undefined,
    };
    const result = await this.dealsService.findAll(dealFilters, {
      limit,
      page: 1,
    });
    let deals = result.deals;

    if (filters.createdAfter) {
      const after = new Date(filters.createdAfter);
      deals = deals.filter((d) => new Date(d.createdAt) >= after);
    }
    if (filters.createdBefore) {
      const before = new Date(filters.createdBefore);
      deals = deals.filter((d) => new Date(d.createdAt) <= before);
    }

    if (dto.aggregation === 'count') {
      return { count: deals.length, filters: dto.filters };
    }
    if (dto.groupBy) {
      const grouped: Record<string, unknown[]> = {};
      for (const d of deals) {
        const deal = d as {
          id: number;
          title: string;
          value?: number | null;
          stage?: string | null;
          owners?: { userId: number }[];
          createdAt: Date;
        };
        const key =
          dto.groupBy === 'ownerId'
            ? (deal.owners?.[0]?.userId?.toString() ?? 'no-owner')
            : (deal.stage ?? 'no-stage');
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({
          id: deal.id,
          title: deal.title,
          value: deal.value,
          stage: deal.stage,
          createdAt: deal.createdAt?.toISOString?.(),
        });
      }
      return {
        grouped,
        totalCount: deals.length,
        groupCount: Object.keys(grouped).length,
      };
    }
    return {
      deals: deals.slice(0, limit).map((d: Record<string, any>) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        currency: d.currency,
        stage: d.stage,
        probability: d.probability,
        expectedCloseDate: d.expectedCloseDate?.toISOString?.() ?? null,
        companyCount: d._count?.companies ?? 0,
        contactCount: d._count?.contacts ?? 0,
        ownerCount: d.owners?.length ?? 0,
        createdAt: d.createdAt?.toISOString?.(),
      })),
      count: deals.length,
      filters: dto.filters,
    };
  }

  @Post('deals')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a deal (agent)' })
  @ApiResponse({ status: 201, description: 'Deal created' })
  async createDeal(
    @OrgId() organizationId: number,
    @Body() dto: DealCreateDto,
  ) {
    return this.dealsService.create(
      {
        organizationId,
        title: dto.title,
        value: dto.value,
        currency: dto.currency,
        probability: dto.probability,
        stage: dto.stage,
        summary: dto.summary,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : undefined,
        source: dto.source,
        priority: dto.priority,
        ownerIds: dto.ownerIds,
        primaryOwnerId: dto.primaryOwnerId,
      },
      undefined,
      ACTIVITY_SOURCES.AI,
    );
  }

  @Patch('deals/:id')
  @ApiOperation({ summary: 'Update a deal (agent)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Deal updated' })
  async updateDeal(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DealUpdateDto,
  ) {
    return this.dealsService.update(
      id,
      organizationId,
      {
        ...dto,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : undefined,
        actualCloseDate: dto.actualCloseDate
          ? new Date(dto.actualCloseDate)
          : undefined,
      },
      undefined,
      ACTIVITY_SOURCES.AI,
    );
  }

  // --- Tasks ---

  @Get('tasks')
  @ApiOperation({ summary: 'List tasks (agent)' })
  @ApiResponse({ status: 200, description: 'Paginated task list' })
  async listTasks(
    @OrgId() organizationId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('parentId') parentId?: string,
    @Query('search') search?: string,
  ) {
    return this.taskService.getTasks(organizationId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      parentId:
        parentId !== undefined
          ? parentId === 'null'
            ? null
            : Number(parentId)
          : undefined,
      search,
    });
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get task by ID (agent)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Task details' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getTask(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.taskService.getTaskById(organizationId, id);
  }

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a task (agent)' })
  @ApiResponse({ status: 201, description: 'Task created' })
  async createTask(
    @OrgId() organizationId: number,
    @Body()
    dto: {
      title: string;
      description?: string;
      status?: 'todo' | 'in_progress' | 'done';
      parentId?: number;
      assignee?: string;
    },
  ) {
    return this.taskService.createTask(organizationId, {
      ...dto,
      status: dto.status ? toTaskStatus(dto.status) : undefined,
      description: dto.description
        ? {
            time: Date.now(),
            blocks: [{ type: 'paragraph', data: { text: dto.description } }],
            version: '2.28.0',
          }
        : undefined,
    });
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update a task (agent)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Updated task' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async updateTask(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    dto: {
      title?: string;
      description?: string;
      status?: 'todo' | 'in_progress' | 'done';
      parentId?: number | null;
      assignee?: string | null;
      completedAt?: string | null;
    },
  ) {
    return this.taskService.updateTask(organizationId, id, {
      ...dto,
      status: dto.status ? toTaskStatus(dto.status) : undefined,
      description: dto.description
        ? {
            time: Date.now(),
            blocks: [{ type: 'paragraph', data: { text: dto.description } }],
            version: '2.28.0',
          }
        : undefined,
      completedAt:
        dto.completedAt !== undefined
          ? dto.completedAt
            ? new Date(dto.completedAt)
            : null
          : undefined,
    });
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task (agent)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Task deleted' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async deleteTask(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.taskService.deleteTask(organizationId, id);
  }
}
