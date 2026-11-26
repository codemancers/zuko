import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toolScopes } from '../agent/lib/scopes';

const tools = readdirSync(new URL('../agent/tools', import.meta.url))
  .filter((file) => file.endsWith('.ts'))
  .map((file) => file.replace(/\.ts$/, ''));

describe('tool scopes', () => {
  // The MCP endpoint refuses a tool with no declared scope, so a new tool must be listed.
  it('declares an OAuth scope for every tool, and for nothing else', () => {
    expect(Object.keys(toolScopes).sort()).toEqual([...tools].sort());
  });

  it('asks for the comment scopes for comment tools: reading to see, writing to add, edit or delete', () => {
    expect(toolScopes).toMatchObject({
      list_comments: 'comments:read',
      get_record_activity: 'comments:read',
      add_comment: 'comments:write',
      update_comment: 'comments:write',
      delete_comment: 'comments:write',
    });
  });
});
