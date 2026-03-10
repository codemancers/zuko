import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ViewsService } from './views.service';
import { ColumnMetadata, PaginationInfo } from '@zuko/sales';

describe('ViewsService', () => {
  let service: ViewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ViewsService],
    }).compile();

    service = module.get<ViewsService>(ViewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildTableView', () => {
    const mockPagination: PaginationInfo = {
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    it('correctly formats a simple entity without formats', () => {
      const metadata: ColumnMetadata[] = [
        { id: 'name', header: 'Name', type: 'text' },
      ];
      const entities = [{ id: 1, name: 'John Doe' }];

      const result = service.buildTableView(entities, metadata, mockPagination);

      expect(result.data[0]).toEqual({ id: 1, name: 'John Doe' });
      expect(result.metadata).toEqual(metadata);
      expect(result.pagination).toEqual(mockPagination);
    });

    it('formats owner field correctly', () => {
      const metadata: ColumnMetadata[] = [
        { 
          id: 'owners', 
          header: 'Owner', 
          type: 'text', 
          config: { format: 'owner' } 
        },
      ];
      const entities = [
        { 
          id: 1, 
          owners: [
            { isPrimary: false, user: { name: 'Secondary' } },
            { isPrimary: true, user: { name: 'Primary' } },
          ] 
        },
      ];

      const result = service.buildTableView<{ owners: string }>(entities, metadata, mockPagination);

      expect(result.data[0].owners).toBe('Primary');
    });

    it('uses first owner if no primary owner found', () => {
      const metadata: ColumnMetadata[] = [
        { 
          id: 'owners', 
          header: 'Owner', 
          type: 'text', 
          config: { format: 'owner' } 
        },
      ];
      const entities = [
        { 
          id: 1, 
          owners: [
            { isPrimary: false, user: { name: 'First' } },
          ] 
        },
      ];

      const result = service.buildTableView<{ owners: string }>(entities, metadata, mockPagination);

      expect(result.data[0].owners).toBe('First');
    });

    it('should format date field correctly', () => {
      const metadata: ColumnMetadata[] = [
        { 
          id: 'createdAt', 
          header: 'Created', 
          type: 'date', 
          config: { format: 'date' } 
        },
      ];
      const testDate = '2025-03-10T12:00:00Z';
      const entities = [{ id: 1, createdAt: testDate }];

      const result = service.buildTableView<{ createdAt: { value: string; display: string } }>(entities, metadata, mockPagination);

      expect(result.data[0].createdAt).toEqual({
        value: testDate,
        display: '10 Mar 2025',
      });
    });

    it('should handle null date field', () => {
      const metadata: ColumnMetadata[] = [
        { id: 'createdAt', header: 'Created', type: 'date', config: { format: 'date' } },
      ];
      const entities = [{ id: 1, createdAt: null }];

      const result = service.buildTableView<{ createdAt: { display: string } }>(entities, metadata, mockPagination);

      expect(result.data[0].createdAt.display).toBe('-');
    });

    it('formats currency field correctly', () => {
      const metadata: ColumnMetadata[] = [
        { 
          id: 'value', 
          header: 'Value', 
          type: 'currency', 
          config: { format: 'currency', currency: 'USD' } 
        },
      ];
      const entities = [{ id: 1, value: 5000 }];

      const result = service.buildTableView<{ value: { value: number; display: string } }>(entities, metadata, mockPagination);

      expect(result.data[0].value).toEqual({
        value: 5000,
        display: '$5,000',
      });
    });

    it('handles null currency field', () => {
      const metadata: ColumnMetadata[] = [
        { id: 'value', header: 'Value', type: 'currency', config: { format: 'currency' } },
      ];
      const entities = [{ id: 1, value: null }];

      const result = service.buildTableView<{ value: { display: string } }>(entities, metadata, mockPagination);

      expect(result.data[0].value.display).toBe('-');
    });

    it('formats stage field correctly', () => {
      const metadata: ColumnMetadata[] = [
        { 
          id: 'stage', 
          header: 'Stage', 
          type: 'badge', 
          config: { format: 'stage' } 
        },
      ];
      const entities = [{ id: 1, stage: 'closed_won' }];

      const result = service.buildTableView<{ stage: { value: string; display: string } }>(entities, metadata, mockPagination);

      expect(result.data[0].stage).toEqual({
        value: 'closed_won',
        display: 'Closed Won',
      });
    });

    it('handles null stage field', () => {
      const metadata: ColumnMetadata[] = [
        { id: 'stage', header: 'Stage', type: 'badge', config: { format: 'stage' } },
      ];
      const entities = [{ id: 1, stage: null }];

      const result = service.buildTableView<{ stage: { display: string } }>(entities, metadata, mockPagination);

      expect(result.data[0].stage.display).toBe('-');
    });

    it('uses accessorKey if provided in config', () => {
      const metadata: ColumnMetadata[] = [
        { 
          id: 'custom_id', 
          header: 'Stage', 
          type: 'badge', 
          config: { format: 'stage', accessorKey: 'actual_field' } 
        },
      ];
      const entities = [{ id: 1, actual_field: 'prospecting' }];

      const result = service.buildTableView<{ actual_field: { value: string; display: string } }>(entities, metadata, mockPagination);

      expect(result.data[0].actual_field).toEqual({
        value: 'prospecting',
        display: 'Prospecting',
      });
    });
  });
});
