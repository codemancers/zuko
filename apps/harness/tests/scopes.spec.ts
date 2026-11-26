import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toolScopes } from '../agent/lib/scopes';

// eve's sandbox tools (bash, read_file, write_file, edit_file) come from eve's own defaults, which the
// MCP endpoint does not publish, and they have no scope, so external clients can neither see nor call
// them. `glob` and `grep` are opt-in files here and would be published, so they are not enabled.
const sandboxTools = ['bash', 'read_file', 'write_file', 'edit_file', 'glob', 'grep'];
// Tool files that only switch an eve default off; they publish nothing.
const disabledTools = ['web_fetch', 'web_search'];

const allTools = readdirSync(new URL('../agent/tools', import.meta.url))
  .filter((file) => file.endsWith('.ts'))
  .map((file) => file.replace(/\.ts$/, ''));
const tools = allTools.filter((name) => !disabledTools.includes(name));

describe('tool scopes', () => {
  // The MCP endpoint refuses a tool with no declared scope, so a new tool must be listed.
  it('declares an OAuth scope for every tool, and for nothing else', () => {
    expect(Object.keys(toolScopes).sort()).toEqual([...tools].sort());
  });

  it('leaves the sandbox tools unscoped, and does not add authored copies that MCP would publish', () => {
    for (const name of sandboxTools) {
      expect(Object.hasOwn(toolScopes, name)).toBe(false);
      expect(allTools).not.toContain(name);
    }
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
