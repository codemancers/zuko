import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  CompaniesService,
  ContactsService,
  DealsService,
  TableColumnRepository,
  COMPANY_TABLE_METADATA,
  CONTACT_TABLE_METADATA,
  DEAL_TABLE_METADATA,
  MEETING_TABLE_METADATA,
  TASK_TABLE_METADATA,
  LEAD_TABLE_METADATA,
  mapTableColumnsToMetadata,
  COLUMN_TYPES,
  mergeCustomFieldValue,
  castFieldValue,
  type ColumnMetadata,
  type FlattenedContact,
  type FlattenedCompany,
  type FlattenedDeal,
  type ColumnType,
} from '@zuko/sales';
import { TableRowBuilder } from './row-builder/table-row.builder';
import type { CompanyListQueryDto } from '../companies.controller';
import type { ContactListQueryDto } from '../contacts.controller';
import type { DealListQueryDto } from '../deals.controller';
import type { CreateColumnDto, UpdateCellDto } from './table.controller';
import type { TableColumn } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TableService {
  private readonly logger = new Logger(TableService.name);

  constructor(
    private readonly companiesService: CompaniesService,
    private readonly contactsService: ContactsService,
    private readonly dealsService: DealsService,
    private readonly rowBuilder: TableRowBuilder,
    private readonly tableColumnRepository: TableColumnRepository,
    private readonly prisma: PrismaService,
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

    const [result, dynamicColumnMetadata] = await Promise.all([
      this.companiesService.findAll(filters, pagination),
      this.tableColumnRepository.findByTable(organizationId, 'companies'),
    ]);

    const { metadata, data } = this.buildMergedTable<FlattenedCompany>(
      result.companies, //data
      COMPANY_TABLE_METADATA, //default column metadata
      dynamicColumnMetadata, //dynamic column metadata
    );

    return {
      metadata,
      data,
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

    const [result, dynamicColumnMetadata] = await Promise.all([
      this.contactsService.findAll(filters, pagination),
      this.tableColumnRepository.findByTable(organizationId, 'contacts'),
    ]);

    const { metadata, data } = this.buildMergedTable<FlattenedContact>(
      result.contacts, //data
      CONTACT_TABLE_METADATA, //default column metadata
      dynamicColumnMetadata, //dynamic column metadata
    );

    return {
      metadata,
      data,
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

    const [result, dynamicColumnMetadata] = await Promise.all([
      this.dealsService.findAll(filters, pagination),
      this.tableColumnRepository.findByTable(organizationId, 'deals'),
    ]);

    const { metadata, data } = this.buildMergedTable<FlattenedDeal>(
      result.deals, //data
      DEAL_TABLE_METADATA, //default column metadata
      dynamicColumnMetadata, //dynamic column metadata
    );

    return {
      metadata,
      data,
      pagination: result.pagination,
    };
  }

  async getTasksTable(
    organizationId: number,
    search?: string,
    page = 1,
    limit = 50,
  ) {
    const where = {
      organizationId,
      parentId: null,
      ...(search
        ? { title: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [total, tasks] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: { owners: { include: { user: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const { metadata, data } = this.buildMergedTable(
      tasks as unknown as Record<string, unknown>[],
      TASK_TABLE_METADATA,
      [],
    );

    return {
      metadata,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMeetingsTable(
    organizationId: number,
    search?: string,
    page = 1,
    limit = 50,
  ) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [total, meetings] = await Promise.all([
      this.prisma.meeting.count({ where }),
      this.prisma.meeting.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const meetingsWithDateFallback = meetings.map((m) => ({
      ...m,
      scheduledAt: m.scheduledAt ?? m.createdAt,
    }));

    const { metadata, data } = this.buildMergedTable(
      meetingsWithDateFallback as unknown as Record<string, unknown>[],
      MEETING_TABLE_METADATA,
      [],
    );

    return {
      metadata,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLeadsTable(
    organizationId: number,
    search?: string,
    status?: string,
    page = 1,
    limit = 50,
  ) {
    const where = {
      organizationId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              {
                companyName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
    };

    const [total, leads] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: { icpProfile: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const flatLeads = leads.map((l) => ({
      ...l,
      icpProfile: l.icpProfile?.name ?? null,
      icpProfileId: l.icpProfile?.id ?? null,
    }));

    const { metadata, data } = this.buildMergedTable(
      flatLeads as unknown as Record<string, unknown>[],
      LEAD_TABLE_METADATA,
      [],
    );

    return {
      metadata,
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createColumn(
    entity: string,
    organizationId: number,
    userId: number,
    dto: CreateColumnDto,
  ) {
    if (!dto || !dto.label || !dto.columnKey || !dto.fieldType) {
      throw new BadRequestException('Invalid request body');
    }

    // check if entity is valid
    const ALLOWED = ['contacts', 'companies', 'deals'];
    if (!ALLOWED.includes(entity)) {
      throw new BadRequestException('Invalid entity type');
    }

    if (dto.fieldType && !COLUMN_TYPES.includes(dto.fieldType)) {
      throw new BadRequestException('Invalid field type');
    }

    // build reserved key list from entity metadata
    let reservedKeys: string[] = [];
    if (entity === 'companies') {
      reservedKeys = COMPANY_TABLE_METADATA.map((metadata) => metadata.id);
    } else if (entity === 'contacts') {
      reservedKeys = CONTACT_TABLE_METADATA.map((metadata) => metadata.id);
    } else if (entity === 'deals') {
      reservedKeys = DEAL_TABLE_METADATA.map((metadata) => metadata.id);
    }

    const validKeyRegex = /^[a-z0-9_]+$/;
    if (!validKeyRegex.test(dto.columnKey)) {
      throw new BadRequestException(
        'Column key must contain only lowercase letters, numbers, and underscores',
      );
    }

    const columnKey = dto.columnKey;

    const reservedKeysSet = new Set(reservedKeys);
    if (reservedKeysSet.has(columnKey)) {
      throw new BadRequestException('Column key already exists');
    }

    const existing = await this.tableColumnRepository.findByKey(
      organizationId,
      entity,
      columnKey,
    );

    if (existing) {
      throw new BadRequestException('Column key already exists');
    }

    try {
      return await this.tableColumnRepository.create({
        organizationId,
        createdById: userId,
        tableName: entity,
        columnKey,
        label: dto.label,
        fieldType: dto.fieldType,
        isRequired: dto.isRequired ?? false,
        config: dto.config ?? {},
      });
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to create column');
    }
  }

  async updateCell(
    entity: string,
    rowId: number,
    organizationId: number,
    actorId: number,
    dto: UpdateCellDto,
  ) {
    const { columnId, value } = dto;

    try {
      let result: unknown;

      switch (entity) {
        case 'contacts': {
          const isDefaultColumn = CONTACT_TABLE_METADATA.find(
            (m) => m.id === columnId,
          );
          if (isDefaultColumn) {
            result = await this.contactsService.update(
              rowId,
              organizationId,
              {
                [columnId]: castFieldValue(
                  value,
                  isDefaultColumn.fieldType as ColumnType,
                ),
              },
              actorId,
            );
          } else {
            const contact = await this.contactsService.findById(
              rowId,
              organizationId,
            );
            const columnMetadata = await this.tableColumnRepository.findByKey(
              organizationId,
              'contacts',
              columnId,
            );
            if (!columnMetadata) {
              throw new BadRequestException('Column not found');
            }

            const fields = mergeCustomFieldValue(
              contact.fields as Record<string, unknown>,
              columnId,
              value,
              columnMetadata.fieldType as ColumnType,
            );

            result = await this.contactsService.update(
              rowId,
              organizationId,
              { fields },
              actorId,
            );
          }
          break;
        }

        case 'companies': {
          const isDefaultColumn = COMPANY_TABLE_METADATA.find(
            (m) => m.id === columnId,
          );
          if (isDefaultColumn) {
            result = await this.companiesService.update(
              rowId,
              organizationId,
              {
                [columnId]: castFieldValue(
                  value,
                  isDefaultColumn.fieldType as ColumnType,
                ),
              },
              actorId,
            );
          } else {
            const company = await this.companiesService.findById(
              rowId,
              organizationId,
            );
            const columnMetadata = await this.tableColumnRepository.findByKey(
              organizationId,
              'companies',
              columnId,
            );
            if (!columnMetadata) {
              throw new BadRequestException('Column not found');
            }

            const fields = mergeCustomFieldValue(
              company.fields as Record<string, unknown>,
              columnId,
              value,
              columnMetadata.fieldType as ColumnType,
            );

            result = await this.companiesService.update(
              rowId,
              organizationId,
              { fields },
              actorId,
            );
          }
          break;
        }

        case 'deals': {
          const isDefaultColumn = DEAL_TABLE_METADATA.find(
            (m) => m.id === columnId,
          );
          if (isDefaultColumn) {
            result = await this.dealsService.update(
              rowId,
              organizationId,
              {
                [columnId]: castFieldValue(
                  value,
                  isDefaultColumn.fieldType as ColumnType,
                ),
              },
              actorId,
            );
          } else {
            const deal = await this.dealsService.findById(
              rowId,
              organizationId,
            );
            const columnMetadata = await this.tableColumnRepository.findByKey(
              organizationId,
              'deals',
              columnId,
            );
            if (!columnMetadata) {
              throw new BadRequestException('Column not found');
            }

            const fields = mergeCustomFieldValue(
              deal.fields as Record<string, unknown>,
              columnId,
              value,
              columnMetadata.fieldType as ColumnType,
            );

            result = await this.dealsService.update(
              rowId,
              organizationId,
              { fields },
              actorId,
            );
          }
          break;
        }

        case 'tasks': {
          const col = TASK_TABLE_METADATA.find((m) => m.id === columnId);
          if (!col) throw new BadRequestException('Column not found');
          result = await this.prisma.task.update({
            where: { id: rowId, organizationId },
            data: {
              [columnId]: castFieldValue(value, col.fieldType as ColumnType),
            },
          });
          break;
        }

        default:
          throw new BadRequestException(
            `Entity ${entity} not supported for cell update`,
          );
      }

      this.logger.log(
        `[TableService] Update successful for ${entity} ID: ${rowId}`,
      );
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[TableService] Failed to update cell: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Merges default metadata with custom columns and build row with formatted data
   */
  private buildMergedTable<T>(
    data: Record<string, unknown>[],
    defaultMetadata: ColumnMetadata[],
    customColumns: TableColumn[],
  ): { metadata: ColumnMetadata[]; data: T[] } {
    const customMetadata = mapTableColumnsToMetadata(customColumns);
    const mergedMetadata = [...defaultMetadata, ...customMetadata];

    // flatten data
    const flattenedData = data.map((item) => {
      const { fields, ...rest } = item;
      return {
        ...rest,
        ...(typeof fields === 'object' && fields !== null ? fields : {}),
      } as T;
    });

    return {
      metadata: mergedMetadata,
      data: this.rowBuilder.buildRows<T>(flattenedData, mergedMetadata),
    };
  }
}
