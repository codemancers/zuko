import { Injectable } from '@nestjs/common';
import { ColumnMetadata, TableViewResponse, PaginationInfo } from '@zuko/sales';
import dayjs from 'dayjs';

@Injectable()
export class ViewsService {
  /**
   * Transforms raw data and metadata into a standardized TableViewResponse.
   */
  buildTableView<T>(
    entities: unknown[],
    metadata: ColumnMetadata[],
    pagination: PaginationInfo,
  ): TableViewResponse<T> {
    return {
      data: entities.map((entity) => this.formatEntityForView(entity, metadata) as T),
      metadata,
      pagination
    };
  }

  private formatEntityForView(entity: unknown, metadata: ColumnMetadata[]): Record<string, unknown> {
    const result = { ...(entity as Record<string, any>) };

    for (const col of metadata) {
      const field = col.config?.accessorKey || col.id;
      const value = result[field];
      const format = col.config?.format;

      if (!format) continue;

      switch (format) {
        case 'owner': {
          // Formats owner field to display primary owner name
          const owners = (result.owners as Array<{ 
            isPrimary?: boolean; 
            user?: { name: string }; 
            name?: string 
          }>) || [];
          const primaryOwner = owners.find((o) => o.isPrimary) || owners[0];
          result[field] = primaryOwner?.user?.name || primaryOwner?.name || '-';
          break;
        }

        case 'date':
          // Formats date field to display in dd MMM yyyy format
          if (value) {
            result[field] = {
              value,
              display: dayjs(value).format('DD MMM YYYY'),
            };
          } else {
            result[field] = {
              value,
              display: '-',
            };
          }
          break;

        case 'currency':
          // Formats currency field to display in USD format
          if (value !== undefined && value !== null) {
            result[field] = {
              value,
              display: new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: col.config?.currency || result.currency || 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(value),
            };
          } else {
            result[field] = {
              value,
              display: '-',
            };
          }
          break;

        case 'stage':
          // Formats stage field to display text without underscores
          if (typeof value === 'string') {
            result[field] = {
              value,
              display: value
                .split('_')
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' '),
            };
          } else if (!value) {
            result[field] = {
              value,
              display: '-',
            };
          }
          break;
      }
    }
    return result;
  }
}
