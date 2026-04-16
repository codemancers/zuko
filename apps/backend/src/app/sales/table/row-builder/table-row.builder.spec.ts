import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TableRowBuilder } from './table-row.builder';
import { ColumnMetadata } from '@zuko/sales';

describe('TableRowBuilder', () => {
  let builder: TableRowBuilder;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TableRowBuilder],
    }).compile();

    builder = module.get<TableRowBuilder>(TableRowBuilder);
  });

  it('should be defined', () => {
    expect(builder).toBeDefined();
  });

  describe('buildRows', () => {
    it('correctly returns entities without formats', () => {
      const metadata: ColumnMetadata[] = [
        { id: 'name', header: 'Name', fieldType: 'text', dataType: 'text' },
      ];
      const entities = [{ id: 1, name: 'John Doe' }];

      const result = builder.buildRows(entities, metadata);

      expect(result[0]).toEqual({ id: 1, name: 'John Doe' });
    });

    it('formats owner field correctly to return primary owner', () => {
      const metadata: ColumnMetadata[] = [
        {
          id: 'owners',
          header: 'Owner',
          fieldType: 'text',
          dataType: 'text',
          config: { format: 'owner' },
        },
      ];
      const entities = [
        {
          id: 1,
          owners: [
            { isPrimary: false, user: { name: 'Secondary' } },
            { isPrimary: true, user: { name: 'Primary' } },
          ],
        },
      ];

      const result = builder.buildRows(entities, metadata);

      expect(result[0].owners).toEqual({
        value: { isPrimary: true, user: { name: 'Primary' } },
        display: 'Primary',
      });
    });

    it('uses first owner if no primary owner found', () => {
      const metadata: ColumnMetadata[] = [
        {
          id: 'owners',
          header: 'Owner',
          fieldType: 'text',
          dataType: 'text',
          config: { format: 'owner' },
        },
      ];
      const entities = [
        {
          id: 1,
          owners: [{ isPrimary: false, user: { name: 'First' } }],
        },
      ];

      const result = builder.buildRows(entities, metadata);

      expect(result[0].owners).toEqual({
        value: { isPrimary: false, user: { name: 'First' } },
        display: 'First',
      });
    });

    it('formats date field correctly', () => {
      const metadata: ColumnMetadata[] = [
        {
          id: 'createdAt',
          header: 'Created',
          fieldType: 'date',
          dataType: 'date',
          config: { format: 'date' },
        },
      ];
      const testDate = '2025-03-10T12:00:00Z';
      const entities = [{ id: 1, createdAt: testDate }];

      const result = builder.buildRows(entities, metadata);

      expect(result[0].createdAt).toEqual({
        value: testDate,
        display: '10 Mar 2025',
      });
    });

    it('handles null date field', () => {
      const metadata: ColumnMetadata[] = [
        {
          id: 'createdAt',
          header: 'Created',
          fieldType: 'date',
          dataType: 'date',
          config: { format: 'date' },
        },
      ];
      const entities = [{ id: 1, createdAt: null }];

      const result = builder.buildRows(entities, metadata);

      expect(result[0].createdAt).toEqual({
        value: null,
        display: '',
      });
    });

    it('formats currency field correctly', () => {
      const metadata: ColumnMetadata[] = [
        {
          id: 'value',
          header: 'Value',
          fieldType: 'currency',
          dataType: 'number',
          config: { format: 'currency', currency: 'USD' },
        },
      ];
      const entities = [{ id: 1, value: 5000 }];

      const result = builder.buildRows(entities, metadata);

      expect(result[0].value).toEqual({
        value: 5000,
        display: '$5,000',
      });
    });

    it('handles null currency field', () => {
      const metadata: ColumnMetadata[] = [
        {
          id: 'value',
          header: 'Value',
          fieldType: 'currency',
          dataType: 'number',
          config: { format: 'currency' },
        },
      ];
      const entities = [{ id: 1, value: null }];

      const result = builder.buildRows(entities, metadata);

      expect(result[0].value).toEqual({
        value: null,
        display: '',
      });
    });

    it('formats stage field correctly', () => {
      const metadata: ColumnMetadata[] = [
        {
          id: 'stage',
          header: 'Stage',
          fieldType: 'text',
          dataType: 'text',
          config: { format: 'stage' },
        },
      ];
      const entities = [{ id: 1, stage: 'closed_won' }];

      const result = builder.buildRows(entities, metadata);

      expect(result[0].stage).toEqual({
        value: 'closed_won',
        display: 'Closed Won',
      });
    });

    it('handles null stage field', () => {
      const metadata: ColumnMetadata[] = [
        {
          id: 'stage',
          header: 'Stage',
          fieldType: 'text',
          dataType: 'text',
          config: { format: 'stage' },
        },
      ];
      const entities = [{ id: 1, stage: null }];

      const result = builder.buildRows(entities, metadata);

      expect(result[0].stage).toEqual({
        value: null,
        display: '',
      });
    });

    it('uses accessorKey if provided in config', () => {
      const metadata: ColumnMetadata[] = [
        {
          id: 'custom_id',
          header: 'Stage',
          fieldType: 'text',
          dataType: 'text',
          config: { format: 'stage', accessorKey: 'actual_field' },
        },
      ];
      const entities = [{ id: 1, actual_field: 'prospecting' }];

      const result = builder.buildRows(entities, metadata);

      expect(result[0].actual_field).toEqual({
        value: 'prospecting',
        display: 'Prospecting',
      });
    });
  });
});
