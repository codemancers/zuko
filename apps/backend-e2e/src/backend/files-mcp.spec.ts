import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, type Reply } from '../support/crm-client';
import { connect, openSession } from '../support/mcp-client';

/**
 * Files through the harness MCP, the way an agent uses them. Bytes are only ever uploaded by the app
 * (multipart); the agent works by id.
 *   Acme: owner and alice (a member)
 */
const run = Date.now().toString(36);
const suffix = `-${run}@filesmcp.test`;
const slug = `filesmcp-${run}`;
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');
const API = '/api/v1';
const ALL = 'records:read records:write schema:read comments:read comments:write';
const READ_ONLY = 'records:read schema:read';
const COMMENTS_ONLY = 'comments:read comments:write schema:read';
const pdf = (text: string) => Buffer.from(`%PDF-1.7 ${text}`);

const ok = (reply: Reply, status = 200) => {
  if (reply.status !== status) throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  return reply.data;
};
const upload = async (user: User, name: string, bytes: Buffer = pdf(name)) => ok(await user.upload(`${API}/files`, name, bytes, 'application/pdf'), 201) as { id: string };

beforeAll(async () => {
  for (const user of [owner, alice]) ok(await user.signUp());
  await verifyEmails(suffix);
  const org = ok(await owner.post('/auth/organization/create', { name: 'FilesMcp', slug })).id;
  const invite = ok(await owner.post('/auth/organization/invite-member', { email: alice.email, role: 'member', organizationId: org }));
  ok(await alice.post('/auth/organization/accept-invitation', { invitationId: invite.id }));
  ok(await alice.signIn());
  ok(await owner.post(`${API}/objects/contact/fields`, { name: 'contract', label: 'Contract', type: 'FILE' }), 201);
  ok(await owner.post(`${API}/objects/contact/fields`, { name: 'photos', label: 'Photos', type: 'FILE', config: { many: true } }), 201);
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, [slug], `e2e-filesmcp-${run}-`);
}, 60_000);

describe('files through MCP', () => {
  it('lists the file tools, and describes a file field', async () => {
    const mcp = await openSession((await connect(owner, `e2e-filesmcp-${run}-tools`, ALL)).accessToken);
    try {
      const names = (await mcp.tools()).map((t) => t.name);
      expect(names).toEqual(expect.arrayContaining(['get_file', 'save_file', 'list_record_files', 'add_comment']));
      const described = (await mcp.call('describe_object_type', { object: 'contact' })).data;
      expect(described.fields.find((f: { name: string }) => f.name === 'photos')).toMatchObject({ type: 'FILE', config: { many: true } });
    } finally {
      await mcp.close();
    }
  });

  it('attaches by id through a record and a comment, then lists, reads and opens the files', async () => {
    const mcp = await openSession((await connect(owner, `e2e-filesmcp-${run}-flow`, ALL)).accessToken);
    try {
      const [contract, note] = [await upload(owner, 'contract.pdf'), await upload(owner, 'note.pdf')];
      const made = await mcp.call('create_record', { object: 'contact', properties: { first_name: 'Ada' } });
      expect(made.isError).toBe(false);
      const id = made.data.id as string;

      const attached = await mcp.call('update_record', { object: 'contact', id, properties: { contract: contract.id } });
      expect(attached.isError).toBe(false);
      expect(attached.data.properties.contract).toMatchObject({ id: contract.id, filename: 'contract.pdf', media_type: 'application/pdf' });
      const comment = await mcp.call('add_comment', { object: 'contact', id, body: 'see note', file_ids: [note.id] });
      expect(comment.isError).toBe(false);
      expect(comment.data.files).toEqual([expect.objectContaining({ id: note.id, filename: 'note.pdf' })]);

      const listed = await mcp.call('list_record_files', { object: 'contact', id });
      expect(listed.isError).toBe(false);
      const sources = listed.data.results.map((r: { file: { filename: string }; source: { type: string } }) => `${r.source.type}:${r.file.filename}`).sort();
      expect(sources).toEqual(['comment:note.pdf', 'field:contract.pdf']);
      expect(listed.data.results.find((r: { source: { type: string } }) => r.source.type === 'comment')).toMatchObject({ actor_type: 'MCP' });

      const opened = await mcp.client.callTool({ name: 'get_file', arguments: { id: contract.id } });
      expect(opened.isError).not.toBe(true);
      const parts = opened.content as { type: string; text?: string; mimeType?: string }[];
      expect(JSON.parse(parts[0].text ?? '{}')).toMatchObject({ id: contract.id, filename: 'contract.pdf', media_type: 'application/pdf' });
      expect(parts.length).toBeGreaterThan(1); // the file itself follows its description
    } finally {
      await mcp.close();
    }
  });

  it('refuses inline content and bad ids at the tool and at the record', async () => {
    const mcp = await openSession((await connect(owner, `e2e-filesmcp-${run}-inline`, ALL)).accessToken);
    try {
      const id = (await mcp.call('create_record', { object: 'contact', properties: { first_name: 'Inline' } })).data.id as string;
      const inline = 'data:application/pdf;base64,JVBERi0xLjQK';
      for (const bad of [inline, 'JVBERi0xLjQK', 'https://example.com/a.pdf']) {
        expect((await mcp.call('add_comment', { object: 'contact', id, body: 'x', file_ids: [bad] })).isError).toBe(true);
        const viaRecord = await mcp.call('update_record', { object: 'contact', id, properties: { contract: bad } });
        expect(viaRecord.isError).toBe(true);
      }
      expect((await mcp.call('get_file', { id: inline })).isError).toBe(true);
      expect((await mcp.call('get_file', { id: '999999999' })).isError).toBe(true);
    } finally {
      await mcp.close();
    }
  });

  it('uses the record scopes: reading takes records:read, uploading and attaching take records:write', async () => {
    const f = await upload(owner, 'scoped.pdf');
    const made = ok(await owner.post(`${API}/objects/contact/records`, { properties: { first_name: 'Scoped' } }), 201);
    ok(await owner.patch(`${API}/objects/contact/records/${made.id}`, { properties: { contract: f.id } }));

    // A read-only client can list and open the file, but cannot ask for an upload link or attach.
    const reader = await openSession((await connect(owner, `e2e-filesmcp-${run}-ro`, READ_ONLY)).accessToken);
    try {
      expect((await reader.call('list_record_files', { object: 'contact', id: made.id })).data.results).toHaveLength(1);
      expect((await reader.client.callTool({ name: 'get_file', arguments: { id: f.id } })).isError).not.toBe(true);
      await expect(reader.call('request_file_upload', {})).rejects.toThrow(/Insufficient scope.*records:write/);
      await expect(reader.call('save_file', { path: '/workspace/x' })).rejects.toThrow(/Insufficient scope.*records:write/);
    } finally {
      await reader.close();
    }

    // A client with no record scopes cannot reach files at all, though it may comment.
    const commenter = await openSession((await connect(owner, `e2e-filesmcp-${run}-co`, COMMENTS_ONLY)).accessToken);
    try {
      await expect(commenter.call('get_file', { id: f.id })).rejects.toThrow(/Insufficient scope.*records:read/);
      await expect(commenter.call('list_record_files', { object: 'contact', id: made.id })).rejects.toThrow(/Insufficient scope.*records:read/);
      await expect(commenter.call('request_file_upload', {})).rejects.toThrow(/Insufficient scope.*records:write/);
      expect((await commenter.call('add_comment', { object: 'contact', id: made.id, body: 'with a file', file_ids: [f.id] })).isError).toBe(false);
    } finally {
      await commenter.close();
    }
  });

  it('neither lists nor runs the sandbox tools for MCP clients', async () => {
    const mcp = await openSession((await connect(owner, `e2e-filesmcp-${run}-sandbox`, ALL)).accessToken);
    try {
      const sandbox = ['bash', 'read_file', 'write_file', 'edit_file', 'glob', 'grep', 'web_fetch', 'web_search'];
      const listed = (await mcp.tools()).map((t) => t.name);
      for (const tool of sandbox) expect(listed).not.toContain(tool);
      for (const tool of sandbox) {
        const reply = await mcp.client.callTool({ name: tool, arguments: tool === 'bash' ? { command: 'id' } : { path: '/etc/passwd' } }).catch((e: unknown) => ({ isError: true, thrown: String(e) }));
        expect((reply as { isError?: boolean }).isError).toBe(true);
      }
    } finally {
      await mcp.close();
    }
  });

  it('applies the person\'s own access: a colleague cannot open an unshared file, then can once the record is shared', async () => {
    const f = await upload(owner, 'private.pdf');
    const ownerMcp = await openSession((await connect(owner, `e2e-filesmcp-${run}-own`, ALL)).accessToken);
    const aliceMcp = await openSession((await connect(alice, `e2e-filesmcp-${run}-ali`, ALL)).accessToken);
    try {
      const id = (await ownerMcp.call('create_record', { object: 'contact', properties: { first_name: 'Shared' } })).data.id as string;
      await ownerMcp.call('update_record', { object: 'contact', id, properties: { contract: f.id } });
      expect((await aliceMcp.call('get_file', { id: f.id })).isError).toBe(true);
      expect((await aliceMcp.call('list_record_files', { object: 'contact', id })).isError).toBe(true);
      ok(await owner.post(`${API}/objects/contact/records/${id}/shares`, { user_id: alice.id, access: 'READ' }), 201);
      expect((await aliceMcp.call('get_file', { id: f.id })).isError).toBe(false);
      expect((await aliceMcp.call('list_record_files', { object: 'contact', id })).data.results).toHaveLength(1);
    } finally {
      await ownerMcp.close();
      await aliceMcp.close();
    }
  });

  it('refuses to open a file over 20 MB, naming the limit', async () => {
    const mcp = await openSession((await connect(owner, `e2e-filesmcp-${run}-big`, ALL)).accessToken);
    try {
      const big = await upload(owner, 'big.pdf', Buffer.concat([Buffer.from('%PDF-1.7 '), Buffer.alloc(21 * 1024 * 1024, 1)]));
      const reply = await mcp.call('get_file', { id: big.id });
      expect(reply.isError).toBe(true);
      expect(JSON.stringify(reply.data)).toMatch(/20 MB|FILE_TOO_LARGE/);
    } finally {
      await mcp.close();
    }
  }, 60_000);
});
