import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../agent/', import.meta.url);
const tools = new Set(
  readdirSync(new URL('tools', root))
    .filter((file) => file.endsWith('.ts'))
    .map((file) => file.replace(/\.ts$/, '')),
);
const skills = readdirSync(new URL('skills', root));

describe('skills', () => {
  it('has the funnel and comment skills', () => {
    expect(skills).toEqual(
      expect.arrayContaining([
        'convert-lead',
        'convert-prospect',
        'enrich-record',
        'log-interaction',
        'manage-campaign',
        'summarize-record',
      ]),
    );
  });

  describe.each(skills)('%s', (name) => {
    const file = new URL(`skills/${name}/SKILL.md`, root);
    const text = existsSync(file) ? readFileSync(file, 'utf8') : '';

    it('names itself after its folder and says when to use it', () => {
      const front = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
      expect(front).toMatch(new RegExp(`^name: ${name}$`, 'm'));
      expect(front).toMatch(/^description: Use when /m);
    });

    // A skill that names a tool that does not exist sends the agent down a dead end.
    it('only names tools that exist', () => {
      const named = [
        ...text.matchAll(
          /`((?:list|get|create|update|delete|add|link|unlink|filter|describe)_[a-z_]+)`/g,
        ),
      ].map((match) => match[1]);
      expect(named.length).toBeGreaterThan(0);
      expect(named.filter((tool) => !tools.has(tool))).toEqual([]);
    });
  });

  it('only reads in summarize-record: it names no tool that changes data', () => {
    const text = readFileSync(new URL('skills/summarize-record/SKILL.md', root), 'utf8');
    // The rules section mentions the writing tools only to forbid them.
    const steps = text.split('## Rules')[0];
    expect(steps).not.toMatch(
      /`(?:update_record|create_record|link_record|unlink_record|delete_record|update_comment|delete_comment)`/,
    );
  });
});
