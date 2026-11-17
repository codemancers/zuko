import { describe, expect, it } from 'vitest';
import { hierarchy, HIERARCHY_PLUGIN_ID } from '../index.js';

describe('hierarchy plugin', () => {
  it('registers under its id', () => {
    expect(hierarchy().id).toBe(HIERARCHY_PLUGIN_ID);
  });

  it('declares bigint tables scoped to an organization', () => {
    const { schema } = hierarchy();
    for (const table of [schema.memberReporting, schema.memberHierarchy]) {
      expect(table.fields.organizationId.bigint).toBe(true);
      expect(table.fields.organizationId.references.model).toBe('organization');
    }
  });
});
