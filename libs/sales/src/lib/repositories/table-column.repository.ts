import { Injectable } from '@nestjs/common';
import type { PrismaService } from '../modules/prisma.types';
import { ColumnConfig } from '../types';

@Injectable()
export class TableColumnRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    organizationId: number;
    createdById: number;
    tableName: string;
    columnKey: string;
    label: string;
    fieldType: string;
    isRequired: boolean;
    config: ColumnConfig;
  }) {
    return this.prisma.tableColumn.create({
      data: {
        organizationId: data.organizationId,
        createdById: data.createdById,
        tableName: data.tableName,
        columnKey: data.columnKey,
        label: data.label,
        fieldType: data.fieldType,
        isRequired: data.isRequired,
        config: data.config,
      },
    });
  }

  async findByKey(
    organizationId: number,
    tableName: string,
    columnKey: string,
  ) {
    return this.prisma.tableColumn.findUnique({
      where: {
        organizationId_tableName_columnKey: {
          organizationId,
          tableName,
          columnKey,
        },
      },
    });
  }

  async findByTable(organizationId: number, tableName: string) {
    return this.prisma.tableColumn.findMany({
      where: {
        organizationId,
        tableName,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
