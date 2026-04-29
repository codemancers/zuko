import type { TableColumnRecord} from './column-metadata.mapper';
import { mapTableColumnToMetadata, mapTableColumnsToMetadata } from './column-metadata.mapper';

describe('column-metadata.mapper', () => {
  const mockBaseRecord: TableColumnRecord = {
    id: 1,
    columnKey: 'test_key',
    label: 'Test Label',
    fieldType: 'text',
    isRequired: false,
    config: {},
  };

  describe('mapTableColumnToMetadata', () => {
    it('Maps basic fields correctly', () => {
      const result = mapTableColumnToMetadata(mockBaseRecord);

      expect(result).toMatchObject({
        id: 'test_key',
        header: 'Test Label',
        fieldType: 'text',
        dataType: 'text',
        isRequired: false,
        isVisible: true,
        sortable: true,
        filterable: true,
        searchable: true,
        editable: true,
        default: false,
        config: {},
      });
    });

    it('Defaults fieldType to text and dataType to text for unknown types', () => {
      const record = { ...mockBaseRecord, fieldType: 'unknown' };
      const result = mapTableColumnToMetadata(record);

      expect(result.fieldType).toBe('unknown');
      expect(result.dataType).toBe('text');
    });

    it('Maps various fieldTypes to correct dataTypes', () => {
      const cases = [
        { field: 'number', expected: 'number' },
        { field: 'date', expected: 'date' },
        { field: 'currency', expected: 'number' },
        { field: 'select', expected: 'text' },
        { field: 'entity', expected: 'text' },
        { field: 'multiselect', expected: 'json' },
        { field: 'relation', expected: 'json' },
      ];

      cases.forEach(({ field, expected }) => {
        const result = mapTableColumnToMetadata({ ...mockBaseRecord, fieldType: field });
        expect(result.dataType).toBe(expected);
      });
    });

    describe('config mapping (buildConfig)', () => {
      it('Adds default date format for date fieldType', () => {
        const record = { ...mockBaseRecord, fieldType: 'date', config: {} };
        const result = mapTableColumnToMetadata(record);
        expect(result.config).toEqual({ format: 'date' });
      });

      it('Adds default currency config for currency fieldType', () => {
        const record = { ...mockBaseRecord, fieldType: 'currency', config: {} };
        const result = mapTableColumnToMetadata(record);
        expect(result.config).toEqual({ format: 'currency', currency: 'USD' });
      });

      it('should NOT overwrite existing currency config', () => {
        const record = { 
          ...mockBaseRecord, 
          fieldType: 'currency', 
          config: { format: 'custom', currency: 'EUR' } 
        };
        const result = mapTableColumnToMetadata(record);
        expect(result.config).toEqual({ format: 'custom', currency: 'EUR' });
      });

      it('should handle null/undefined config gracefully', () => {
        const record = { ...mockBaseRecord, config: null as unknown as TableColumnRecord['config'] };
        const result = mapTableColumnToMetadata(record);
        expect(result.config).toEqual({});
      });
    });
  });

  describe('mapTableColumnsToMetadata', () => {
    it('should map an array of records', () => {
      const records: TableColumnRecord[] = [
        { ...mockBaseRecord, id: 1, columnKey: 'col1' },
        { ...mockBaseRecord, id: 2, columnKey: 'col2' },
      ];

      const results = mapTableColumnsToMetadata(records);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('col1');
      expect(results[1].id).toBe('col2');
    });
  });
});
