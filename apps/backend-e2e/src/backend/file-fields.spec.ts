import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, withDb, type Reply } from '../support/crm-client';

/**
 * Files attached to records through FILE fields.
 *   Acme: owner (sees everything), alice and bob (members: see only their own records and what is shared)
 *   Other: carol, in another organization
 */
const run = Date.now().toString(36);
const suffix = `-${run}@filefields.test`;
const slugs = [`ff-acme-${run}`, `ff-other-${run}`];
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');
const bob = mk('bob');
const carol = mk('carol');
const API = '/api/v1';
const FILES = `${API}/files`;
const rec = (id: string) => `${API}/objects/contact/records/${id}`;
const pdf = (text: string) => Buffer.from(`%PDF-1.7 ${text}`);

const ok = (reply: Reply, status = 200) => {
  if (reply.status !== status) throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  return reply.data;
};
const upload = async (user: User, name: string) => ok(await user.upload(FILES, name, pdf(name), 'application/pdf'), 201) as { id: string; filename: string };
const contact = async (user: User, properties: Record<string, unknown> = {}) =>
  ok(await user.post(`${API}/objects/contact/records`, { properties: { first_name: 'C', ...properties } }), 201) as {
    id: string;
    properties: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
const codes = (reply: Reply) => (reply.data?.errors ?? []).map((e: { field: string; code: string }) => `${e.field}:${e.code}`);

beforeAll(async () => {
  for (const user of [owner, alice, bob, carol]) ok(await user.signUp());
  await verifyEmails(suffix);
  const org = ok(await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] })).id;
  for (const user of [alice, bob]) {
    const invite = ok(await owner.post('/auth/organization/invite-member', { email: user.email, role: 'member', organizationId: org }));
    ok(await user.post('/auth/organization/accept-invitation', { invitationId: invite.id }));
    ok(await user.signIn());
  }
  ok(await carol.post('/auth/organization/create', { name: 'Other', slug: slugs[1] }));
  ok(await owner.post(`${API}/objects/contact/fields`, { name: 'contract', label: 'Contract', type: 'FILE' }), 201);
  ok(await owner.post(`${API}/objects/contact/fields`, { name: 'photos', label: 'Photos', type: 'FILE', config: { many: true } }), 201);
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60_000);

describe('attaching', () => {
  it('shows an attached file as a descriptor, on create, get and list', async () => {
    const f = await upload(owner, 'msa.pdf');
    const created = await contact(owner, { contract: f.id });
    const expected = { id: f.id, filename: 'msa.pdf', media_type: 'application/pdf', size: pdf('msa.pdf').length };
    expect(created.properties['contract']).toEqual(expected);
    expect(ok(await owner.get(rec(created.id))).properties.contract).toEqual(expected);
    const listed = ok(await owner.get(`${API}/objects/contact/records?page_size=100`)).results.find((r: { id: string }) => r.id === created.id);
    expect(listed.properties.contract).toEqual(expected);
  });

  it('keeps the order of a field that holds many, and accepts a value read back', async () => {
    const [a, b, c] = [await upload(owner, 'a.pdf'), await upload(owner, 'b.pdf'), await upload(owner, 'c.pdf')];
    const made = await contact(owner, { photos: [c.id, a.id] });
    expect(made.properties['photos'].map((p: { filename: string }) => p.filename)).toEqual(['c.pdf', 'a.pdf']);
    const updated = ok(await owner.patch(rec(made.id), { properties: { photos: [...made.properties['photos'], { id: b.id }] } }));
    expect(updated.properties.photos.map((p: { filename: string }) => p.filename)).toEqual(['c.pdf', 'a.pdf', 'b.pdf']);
  });

  it('lets one file be attached to many records, and detaching one leaves the other', async () => {
    const f = await upload(owner, 'shared.pdf');
    const one = await contact(owner, { contract: f.id });
    const two = await contact(owner, { contract: f.id });
    expect(one.properties['contract'].id).toBe(f.id);
    expect(two.properties['contract'].id).toBe(f.id);
    ok(await owner.patch(rec(one.id), { properties: { contract: null } }));
    expect(ok(await owner.get(rec(one.id))).properties.contract).toBeUndefined();
    expect(ok(await owner.get(rec(two.id))).properties.contract.id).toBe(f.id);
    expect((await owner.get(`${FILES}/${f.id}`)).status).toBe(200); // detaching never deletes the file
  });

  it('records attachments in the record history as ids, with the actor', async () => {
    const f = await upload(owner, 'hist.pdf');
    const made = await contact(owner);
    ok(await owner.patch(rec(made.id), { properties: { contract: f.id } }));
    ok(await owner.patch(rec(made.id), { properties: { contract: null } }));
    const history = ok(await owner.get(`${rec(made.id)}/history`)).results;
    const changes = history.filter((h: { changes: Record<string, unknown> }) => 'contract' in h.changes);
    expect(changes.map((h: { changes: { contract: unknown } }) => h.changes.contract)).toEqual([
      { old: f.id, new: null },
      { old: null, new: f.id },
    ]);
    expect(changes[0]).toMatchObject({ actor_type: 'USER', actor_id: owner.id });
  });

  it('does nothing when the attachments are unchanged', async () => {
    const f = await upload(owner, 'same.pdf');
    const made = await contact(owner, { contract: f.id });
    const before = ok(await owner.get(`${rec(made.id)}/history`)).results.length;
    ok(await owner.patch(rec(made.id), { properties: { contract: f.id } }));
    expect(ok(await owner.get(`${rec(made.id)}/history`)).results.length).toBe(before);
  });
});

describe('what may be attached', () => {
  it('rejects ids that are unknown, malformed, inline content, or the wrong shape', async () => {
    const make = (properties: Record<string, unknown>) => owner.post(`${API}/objects/contact/records`, { properties: { first_name: 'X', ...properties } });
    for (const bad of ['999999999', 'abc', 'data:application/pdf;base64,JVBERi0=', 12, ['1'], true]) {
      const reply = await make({ contract: bad });
      expect(reply.status).toBe(400);
      expect(codes(reply)).toEqual(['contract:INVALID_FIELD']);
    }
    expect((await make({ photos: 'x' })).status).toBe(400);
  });

  it('rejects a file uploaded by someone else that the caller cannot read, another organization\'s file, and a deleted file', async () => {
    const theirs = await upload(alice, 'alices.pdf');
    const foreign = await upload(carol, 'carols.pdf');
    const deleted = await upload(owner, 'deleted.pdf');
    ok(await owner.del(`${FILES}/${deleted.id}`), 204);
    for (const id of [theirs.id, foreign.id, deleted.id]) {
      const reply = await owner.post(`${API}/objects/contact/records`, { properties: { first_name: 'X', contract: id } });
      expect(reply.status).toBe(400);
      expect(codes(reply)).toEqual(['contract:INVALID_FIELD']);
    }
  });

  it('rejects more files than a field holds', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => String(i + 1));
    const reply = await owner.post(`${API}/objects/contact/records`, { properties: { first_name: 'X', photos: ids } });
    expect(reply.status).toBe(400);
  });
});

describe('who can read an attached file', () => {
  it('follows the record: a reader of the record reads the file, others do not', async () => {
    const f = await upload(owner, 'contract.pdf');
    const made = await contact(owner, { contract: f.id });
    for (const u of [alice, bob]) expect((await u.get(`${FILES}/${f.id}`)).status).toBe(404);

    const share = ok(await owner.post(`${rec(made.id)}/shares`, { user_id: alice.id, access: 'READ' }), 201);
    expect((await alice.get(`${FILES}/${f.id}`)).status).toBe(200);
    const down = await alice.download(`${FILES}/${f.id}/content`);
    expect(down.status).toBe(200);
    expect(down.bytes.equals(pdf('contract.pdf'))).toBe(true);
    expect(ok(await alice.get(rec(made.id))).properties.contract.id).toBe(f.id);
    expect((await bob.get(`${FILES}/${f.id}`)).status).toBe(404);
    expect((await carol.get(`${FILES}/${f.id}`)).status).toBe(404);

    ok(await owner.del(`${rec(made.id)}/shares/${share.id}`));
    expect((await alice.get(`${FILES}/${f.id}`)).status).toBe(404);
  });

  it('is lost when the record is deleted', async () => {
    const f = await upload(owner, 'gone.pdf');
    const made = await contact(owner, { contract: f.id });
    ok(await owner.post(`${rec(made.id)}/shares`, { user_id: alice.id, access: 'READ' }), 201);
    expect((await alice.get(`${FILES}/${f.id}`)).status).toBe(200);
    ok(await owner.del(rec(made.id)));
    expect((await alice.get(`${FILES}/${f.id}`)).status).toBe(404);
    expect((await owner.get(`${FILES}/${f.id}`)).status).toBe(200); // still the uploader's
  });

  it('is lost when the field is removed, and comes back when the field is added again', async () => {
    ok(await owner.post(`${API}/objects/contact/fields`, { name: 'temp_doc', label: 'Temp', type: 'FILE' }), 201);
    const f = await upload(owner, 'temp.pdf');
    const made = await contact(owner, { temp_doc: f.id });
    ok(await owner.post(`${rec(made.id)}/shares`, { user_id: alice.id, access: 'READ' }), 201);
    expect((await alice.get(`${FILES}/${f.id}`)).status).toBe(200);
    ok(await owner.del(`${API}/objects/contact/fields/temp_doc`));
    expect((await alice.get(`${FILES}/${f.id}`)).status).toBe(404);
    expect(ok(await owner.get(rec(made.id))).properties).not.toHaveProperty('temp_doc');
    ok(await owner.post(`${API}/objects/contact/fields`, { name: 'temp_doc', label: 'Temp', type: 'FILE' }), 201);
    expect((await alice.get(`${FILES}/${f.id}`)).status).toBe(200);
    expect(ok(await owner.get(rec(made.id))).properties.temp_doc.id).toBe(f.id);
  });

  it('lets a reader attach a file they can read to a record of their own, but not delete it', async () => {
    const f = await upload(owner, 'forwarded.pdf');
    const made = await contact(owner, { contract: f.id });
    ok(await owner.post(`${rec(made.id)}/shares`, { user_id: alice.id, access: 'READ' }), 201);
    const mine = await contact(alice, { contract: f.id });
    expect(mine.properties['contract'].id).toBe(f.id);
    expect((await alice.del(`${FILES}/${f.id}`)).status).toBe(404); // not the uploader
    // Attaching it to a record of hers shares it with that record's readers
    ok(await alice.post(`${rec(mine.id)}/shares`, { user_id: bob.id, access: 'READ' }), 201);
    expect((await bob.get(`${FILES}/${f.id}`)).status).toBe(200);
  });
});

describe('deleting an attached file', () => {
  it('is refused while a record holds it, and works once detached', async () => {
    const f = await upload(owner, 'held.pdf');
    const made = await contact(owner, { contract: f.id });
    const refused = await owner.del(`${FILES}/${f.id}`);
    expect(refused.status).toBe(409);
    expect(refused.data.message).toMatch(/attached to 1 record/);
    ok(await owner.patch(rec(made.id), { properties: { contract: null } }));
    expect((await owner.del(`${FILES}/${f.id}`)).status).toBe(204);
  });
});

describe('the field itself', () => {
  it('cannot be unique or searched', async () => {
    for (const extra of [{ unique: true }, { filterable: true }]) {
      const reply = await owner.post(`${API}/objects/contact/fields`, { name: 'nope', label: 'Nope', type: 'FILE', ...extra });
      expect(reply.status).toBe(400);
    }
  });

  it('can hold many only if no record holds several when changed to one', async () => {
    const [a, b] = [await upload(owner, 'x.pdf'), await upload(owner, 'y.pdf')];
    const made = await contact(owner, { photos: [a.id, b.id] });
    const refused = await owner.patch(`${API}/objects/contact/fields/photos`, { config: { many: false } });
    expect(refused.status).toBe(409);
    ok(await owner.patch(rec(made.id), { properties: { photos: [a.id] } }));
    // another record may still hold several, so the change stays refused until all are single
    const rows = await withDb(async (db) => (await db.query('SELECT count(*)::int AS n FROM record_file')).rows[0].n as number);
    expect(rows).toBeGreaterThan(0);
  });

  it('keeps its cardinality when a removed field is added back, and is not narrowed below what records hold', async () => {
    ok(await owner.post(`${API}/objects/contact/fields`, { name: 'restore_many', label: 'Restore', type: 'FILE', config: { many: true } }), 201);
    const [a, b] = [await upload(owner, 'ra.pdf'), await upload(owner, 'rb.pdf')];
    const made = await contact(owner, { restore_many: [a.id, b.id] });
    ok(await owner.del(`${API}/objects/contact/fields/restore_many`));
    // Asking for one file while a record still holds two is refused, as when changing a field.
    const narrowed = await owner.post(`${API}/objects/contact/fields`, { name: 'restore_many', label: 'Restore', type: 'FILE', config: { many: false } });
    expect(narrowed.status).toBe(409);
    expect(narrowed.data.message).toMatch(/several files/);
    // Adding it back without saying how restores what it was, so both files read back.
    ok(await owner.post(`${API}/objects/contact/fields`, { name: 'restore_many', label: 'Restore', type: 'FILE' }), 201);
    expect(ok(await owner.get(rec(made.id))).properties.restore_many.map((f: { filename: string }) => f.filename)).toEqual(['ra.pdf', 'rb.pdf']);
  });

  it('keeps file values out of the record\'s stored properties', async () => {
    const f = await upload(owner, 'stored.pdf');
    const made = await contact(owner, { contract: f.id });
    const stored = await withDb(async (db) => (await db.query('SELECT properties FROM object_record WHERE id = $1', [made.id])).rows[0].properties);
    expect(stored).not.toHaveProperty('contract');
  });
});

describe('files on comments', () => {
  const comments = (id: string) => `${rec(id)}/comments`;
  const post = async (user: User, recordId: string, body: Record<string, unknown>) => user.post(comments(recordId), body);

  it('attaches files by id, and shows them on the comment, the list and the timeline', async () => {
    const [a, b] = [await upload(owner, 'one.pdf'), await upload(owner, 'two.pdf')];
    const made = await contact(owner);
    const comment = ok(await post(owner, made.id, { body: 'See attached', files: [b.id, a.id] }), 201);
    expect(comment.files.map((f: { filename: string }) => f.filename)).toEqual(['two.pdf', 'one.pdf']);
    expect(comment.files[0]).toMatchObject({ id: b.id, media_type: 'application/pdf', size: pdf('two.pdf').length });
    const listed = ok(await owner.get(comments(made.id))).results;
    expect(listed[0].files.map((f: { id: string }) => f.id)).toEqual([b.id, a.id]);
    const timeline = ok(await owner.get(`${rec(made.id)}/activity`)).results.find((i: { type: string }) => i.type === 'comment');
    expect(timeline.files).toHaveLength(2);
  });

  it('allows a comment that is only a file, but not an empty one', async () => {
    const f = await upload(owner, 'only.pdf');
    const made = await contact(owner);
    expect(ok(await post(owner, made.id, { files: [f.id] }), 201)).toMatchObject({ body: '', files: [{ id: f.id }] });
    for (const empty of [{}, { body: '  ' }, { body: '', files: [] }]) {
      expect((await post(owner, made.id, empty)).status).toBe(400);
    }
  });

  it('rejects ids that are unknown, inline content, unreadable, or too many', async () => {
    const theirs = await upload(carol, 'carols.pdf');
    const made = await contact(owner);
    for (const bad of [['999999999'], ['abc'], ['data:application/pdf;base64,JVBERi0='], [theirs.id]]) {
      expect((await post(owner, made.id, { body: 'x', files: bad })).status).toBe(400);
    }
    const many = Array.from({ length: 11 }, (_, i) => String(i + 1));
    expect((await post(owner, made.id, { body: 'x', files: many })).status).toBe(400);
  });

  it('lets a reader of the record comment with a file of their own, without write access', async () => {
    const made = await contact(owner);
    ok(await owner.post(`${rec(made.id)}/shares`, { user_id: alice.id, access: 'READ' }), 201);
    const mine = await upload(alice, 'alice-notes.pdf');
    const comment = ok(await post(alice, made.id, { body: 'my notes', files: [mine.id] }), 201);
    expect(comment.files[0].id).toBe(mine.id);
    // the record's other readers can now read it too
    expect((await owner.get(`${FILES}/${mine.id}`)).status).toBe(200);
    expect((await bob.get(`${FILES}/${mine.id}`)).status).toBe(404);
  });

  it('shares a file with the readers of the record, until the comment or record goes', async () => {
    const f = await upload(owner, 'minutes.pdf');
    const made = await contact(owner);
    ok(await owner.post(`${rec(made.id)}/shares`, { user_id: alice.id, access: 'READ' }), 201);
    expect((await alice.get(`${FILES}/${f.id}`)).status).toBe(404);
    const comment = ok(await post(owner, made.id, { body: 'minutes', files: [f.id] }), 201);
    expect((await alice.get(`${FILES}/${f.id}`)).status).toBe(200);
    expect((await alice.download(`${FILES}/${f.id}/content`)).bytes.equals(pdf('minutes.pdf'))).toBe(true);
    expect((await bob.get(`${FILES}/${f.id}`)).status).toBe(404);
    ok(await owner.del(`${comments(made.id)}/${comment.id}`));
    expect((await alice.get(`${FILES}/${f.id}`)).status).toBe(404);
  });

  it('blocks deleting a file a comment holds, until the comment is deleted', async () => {
    const f = await upload(owner, 'held-by-comment.pdf');
    const made = await contact(owner);
    const comment = ok(await post(owner, made.id, { body: 'x', files: [f.id] }), 201);
    const refused = await owner.del(`${FILES}/${f.id}`);
    expect(refused.status).toBe(409);
    ok(await owner.del(`${comments(made.id)}/${comment.id}`));
    expect((await owner.del(`${FILES}/${f.id}`)).status).toBe(204);
  });

  it('lets the author change the files, and keeps them when only the text is edited', async () => {
    const [a, b] = [await upload(owner, 'ea.pdf'), await upload(owner, 'eb.pdf')];
    const made = await contact(owner);
    const comment = ok(await post(owner, made.id, { body: 'v1', files: [a.id] }), 201);
    const edited = ok(await owner.patch(`${comments(made.id)}/${comment.id}`, { body: 'v2' }));
    expect(edited.files.map((f: { id: string }) => f.id)).toEqual([a.id]);
    const swapped = ok(await owner.patch(`${comments(made.id)}/${comment.id}`, { files: [b.id] }));
    expect(swapped.files.map((f: { id: string }) => f.id)).toEqual([b.id]);
    expect(swapped.edited_at).not.toBeNull();
    // removing the last file from a comment with no text is refused
    const bare = ok(await post(owner, made.id, { files: [a.id] }), 201);
    expect((await owner.patch(`${comments(made.id)}/${bare.id}`, { files: [] })).status).toBe(400);
    ok(await owner.post(`${rec(made.id)}/shares`, { user_id: alice.id, access: 'WRITE' }), 201);
    expect((await alice.patch(`${comments(made.id)}/${comment.id}`, { files: [] })).status).toBe(403);
  });
});

describe("a record's files", () => {
  const files = (id: string, query = '') => `${rec(id)}/files${query}`;
  const names = (reply: Reply) => ok(reply).results.map((r: { file: { filename: string } }) => r.file.filename);
  const pause = () => new Promise((resolve) => setTimeout(resolve, 15));

  it('lists what is attached through fields and comments, newest first, with where each came from', async () => {
    const made = await contact(owner);
    const [a, b, c] = [await upload(owner, 'field.pdf'), await upload(owner, 'c1.pdf'), await upload(owner, 'c2.pdf')];
    ok(await owner.patch(rec(made.id), { properties: { contract: a.id } }));
    await pause();
    const comment = ok(await owner.post(`${rec(made.id)}/comments`, { body: 'two files', files: [b.id, c.id] }), 201);
    const listed = ok(await owner.get(files(made.id))).results;
    expect(listed.map((r: { file: { filename: string } }) => r.file.filename)).toEqual(expect.arrayContaining(['field.pdf', 'c1.pdf', 'c2.pdf']));
    expect(listed).toHaveLength(3);
    expect(listed.at(-1)).toMatchObject({ file: { id: a.id, media_type: 'application/pdf' }, source: { type: 'field', field: 'contract', label: 'Contract' } });
    const fromComment = listed.filter((r: { source: { type: string } }) => r.source.type === 'comment');
    expect(fromComment).toHaveLength(2);
    expect(fromComment[0]).toMatchObject({ source: { comment_id: comment.id }, attached_by: { id: owner.id, name: owner.name }, actor_type: 'USER' });
    const times = listed.map((r: { attached_at: string }) => r.attached_at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('drops files that are detached, on a deleted comment, or on a removed field', async () => {
    ok(await owner.post(`${API}/objects/contact/fields`, { name: 'tmp_list', label: 'Tmp', type: 'FILE' }), 201);
    const made = await contact(owner);
    const [a, b, c] = [await upload(owner, 'keep.pdf'), await upload(owner, 'gone-comment.pdf'), await upload(owner, 'gone-field.pdf')];
    ok(await owner.patch(rec(made.id), { properties: { contract: a.id, tmp_list: c.id } }));
    const comment = ok(await owner.post(`${rec(made.id)}/comments`, { body: 'x', files: [b.id] }), 201);
    expect(names(await owner.get(files(made.id))).sort()).toEqual(['gone-comment.pdf', 'gone-field.pdf', 'keep.pdf']);
    ok(await owner.del(`${rec(made.id)}/comments/${comment.id}`));
    ok(await owner.del(`${API}/objects/contact/fields/tmp_list`));
    expect(names(await owner.get(files(made.id)))).toEqual(['keep.pdf']);
    ok(await owner.patch(rec(made.id), { properties: { contract: null } }));
    expect(ok(await owner.get(files(made.id))).results).toEqual([]);
  });

  it('is only for people who can read the record, and the files in it are then readable', async () => {
    const made = await contact(owner);
    const f = await upload(owner, 'visible.pdf');
    ok(await owner.patch(rec(made.id), { properties: { contract: f.id } }));
    expect((await alice.get(files(made.id))).status).toBe(404);
    ok(await owner.post(`${rec(made.id)}/shares`, { user_id: alice.id, access: 'READ' }), 201);
    const listed = ok(await alice.get(files(made.id))).results;
    expect(listed).toHaveLength(1);
    expect((await alice.get(`${FILES}/${listed[0].file.id}`)).status).toBe(200);
    for (const outsider of [bob, carol]) expect((await outsider.get(files(made.id))).status).toBe(404);
  });

  it('limits the list, and refuses a bad limit', async () => {
    const made = await contact(owner);
    const ids = [await upload(owner, 'l1.pdf'), await upload(owner, 'l2.pdf'), await upload(owner, 'l3.pdf')].map((f) => f.id);
    ok(await owner.patch(rec(made.id), { properties: { photos: ids } }));
    expect(ok(await owner.get(files(made.id, '?limit=2'))).results).toHaveLength(2);
    for (const bad of ['0', '201', 'x']) expect((await owner.get(files(made.id, `?limit=${bad}`))).status).toBe(400);
    expect((await owner.get(files('999999999'))).status).toBe(404);
  });
});

describe('deleting a file while it is being attached', () => {
  /** Run the two requests together; report which one won, or what was wrong if neither cleanly did. */
  const outcome = (del: Reply, attach: Reply, attached: boolean, gone: boolean, attachedOk: number) => {
    if (del.status === 204 && attach.status === 400 && !attached && gone) return 'deleted';
    if (del.status === 409 && attach.status === attachedOk && attached && !gone) return 'attached';
    return `broken: delete ${del.status}, attach ${attach.status}, attached ${attached}, file gone ${gone}`;
  };

  it('never leaves a file both deleted and attached to a record', async () => {
    const results: string[] = [];
    for (let i = 0; i < 12; i++) {
      const f = await upload(owner, `race${i}.pdf`);
      const record = await contact(owner);
      const [del, attach] = await Promise.all([owner.del(`${FILES}/${f.id}`), owner.patch(rec(record.id), { properties: { contract: f.id } })]);
      const held = ok(await owner.get(rec(record.id))).properties.contract;
      results.push(outcome(del, attach, held?.id === f.id, (await owner.get(`${FILES}/${f.id}`)).status === 404, 200));
    }
    expect(results.filter((r) => r.startsWith('broken'))).toEqual([]);
  }, 60_000);

  it('never leaves a file-only comment whose file was deleted', async () => {
    const results: string[] = [];
    for (let i = 0; i < 8; i++) {
      const f = await upload(owner, `race${100 + i}.pdf`);
      const record = await contact(owner);
      const [del, comment] = await Promise.all([owner.del(`${FILES}/${f.id}`), owner.post(`${rec(record.id)}/comments`, { files: [f.id] })]);
      const shown = (comment.data?.files ?? []).some((x: { id: string }) => x.id === f.id);
      results.push(outcome(del, comment, shown, (await owner.get(`${FILES}/${f.id}`)).status === 404, 201));
    }
    expect(results.filter((r) => r.startsWith('broken'))).toEqual([]);
  }, 60_000);
});
