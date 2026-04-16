import { Injectable } from '@nestjs/common';
import { ColumnMetadata } from '@zuko/sales';
import dayjs from 'dayjs';

/**
 * Transforms raw data and metadata into a standardized TableViewResponse.
 */

@Injectable()
export class TableRowBuilder {
  private formatters = {
    owner: this.formatOwner,
    date: this.formatDate,
    currency: this.formatCurrency,
    stage: this.formatStage,
  };

  buildRows<T>(entities: T[], metadata: ColumnMetadata[]): T[] {
    return entities.map((entity) =>
      this.buildRow(entity as Record<string, unknown>, metadata),
    ) as T[];
  }

  private buildRow(
    entity: Record<string, unknown>,
    metadata: ColumnMetadata[],
  ) {
    const result = { ...entity };

    for (const column of metadata) {
      const field = column.config?.accessorKey || column.id;
      const value = result[field];
      const format = column.config?.format;

      if (!format) continue;

      const formatter = this.formatters[format];

      if (!formatter) continue;

      result[field] = formatter(value, entity, column);
    }

    return result;
  }

  // Formats date field to display date in DD MMM YYYY format
  private formatDate(value: unknown) {
    if (!value) return { value, display: '' };

    return {
      value,
      display: dayjs(value as string).format('DD MMM YYYY'),
    };
  }

  // Formats currency field to display currency
  private formatCurrency(
    value: unknown,
    entity: Record<string, unknown>,
    column: ColumnMetadata,
  ) {
    if (!value) return { value, display: '' };

    return {
      value,
      display: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency:
          (entity.currency as string) || column.config?.currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value as number),
    };
  }

  // Formats stage field to display text without underscores
  private formatStage(value: unknown) {
    if (!value) return { value, display: '' };

    return {
      value,
      display: (value as string)
        .split('_')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
    };
  }

  // Formats owner field to display primary owner name
  private formatOwner(
    value: unknown,
    entity: Record<string, unknown>,
    column: ColumnMetadata,
  ) {
    if (!value) return { value, display: '' };

    const owners =
      (value as Array<{
        isPrimary?: boolean;
        user?: { name: string };
        name?: string;
      }>) || [];
    const primaryOwner = owners.find((o) => o.isPrimary) || owners[0];

    return {
      value: primaryOwner,
      display: primaryOwner?.user?.name || primaryOwner?.name || '',
    };
  }
}
