import { describe, expect, it } from 'vitest';
import { audit, AUDIT_PLUGIN_ID } from '../index.js';

describe('audit plugin', () => {
  it('registers under its id', () => {
    expect(audit().id).toBe(AUDIT_PLUGIN_ID);
  });

  it('declares an audit event table with actor and event fields', () => {
    const { fields } = audit().schema.auditEvent;
    expect(fields.event.required).toBe(true);
    expect(fields.actorType.required).toBe(true);
  });
});
