import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, type Reply } from '../support/crm-client';

/**
 * Linking records: many-to-many, the same from either side, and always within what the caller
 * may see and change.
 *   Acme: owner (sees everything), alice and bob (members: their own records)      Other org: eve
 */
const run = Date.now().toString(36);
const suffix = `-${run}@assoc.test`;
const slugs = [`assoc-acme-${run}`, `assoc-eve-${run}`];
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');
const bob = mk('bob');
const eve = mk('eve');
const API = '/api/v1';
const rec = (object: string, id?: string) =>
  `${API}/objects/${object}/records${id ? `/${id}` : ''}`;
const links = (object: string, id: string, target: string, targetId?: string) =>
  `${rec(object, id)}/associations/${target}${targetId ? `/${targetId}` : ''}`;

function ok(reply: Reply, status = 200) {
  if (reply.status !== status) {
    throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  }
  return reply.data;
}
const create = async (user: User, object: string, properties: Record<string, unknown>) =>
  ok(await user.post(rec(object), { properties }), 201).id as string;
const ids = (data: { results: { id: string }[] }) => data.results.map((r) => r.id);
// Links come oldest first, which depends on what an earlier test did; most checks only care who.
const sorted = (list: string[]) => [...list].sort();

let ada: string; // contact (owner's)
let grace: string; // contact (owner's)
let acme: string; // company (owner's)
let globex: string; // company (owner's)
let renewal: string; // deal (owner's)

beforeAll(async () => {
  for (const user of [owner, alice, bob, eve]) ok(await user.signUp());
  await verifyEmails(suffix);
  const org = ok(
    await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] }),
  ).id;
  ok(await eve.post('/auth/organization/create', { name: 'Eve Co', slug: slugs[1] }));
  for (const user of [alice, bob]) {
    const invite = ok(
      await owner.post('/auth/organization/invite-member', {
        email: user.email,
        role: 'member',
        organizationId: org,
      }),
    );
    ok(await user.post('/auth/organization/accept-invitation', { invitationId: invite.id }));
    ok(await user.signIn());
  }
  ada = await create(owner, 'contact', { first_name: 'Ada', last_name: 'Lovelace' });
  grace = await create(owner, 'contact', { first_name: 'Grace', last_name: 'Hopper' });
  acme = await create(owner, 'company', { name: 'Analytical Engines' });
  globex = await create(owner, 'company', { name: 'Globex' });
  renewal = await create(owner, 'deal', { name: 'Renewal' });
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60_000);

describe('linking', () => {
  it('links records many-to-many, and shows the link from both sides', async () => {
    ok(await owner.put(links('contact', ada, 'contact_company'), { record_ids: [acme, globex] }));
    ok(await owner.put(links('contact', grace, 'contact_company'), { record_ids: [acme] }));

    const adaCompanies = ok(await owner.get(links('contact', ada, 'contact_company')));
    expect(ids(adaCompanies)).toEqual([acme, globex]);
    expect(adaCompanies.results[0]).toMatchObject({
      object: 'company',
      label: 'Analytical Engines',
      properties: { name: 'Analytical Engines' },
    });
    expect(adaCompanies.metadata.total_elements).toBe(2);
    // The same links, read from the company's side: two contacts at one company.
    expect(ids(ok(await owner.get(links('company', acme, 'contact_company'))))).toEqual([
      ada,
      grace,
    ]);
    expect(ids(ok(await owner.get(links('company', globex, 'contact_company'))))).toEqual([ada]);
  });

  it('answers with who is linked, by name', async () => {
    const reply = ok(
      await owner.put(links('contact', ada, 'contact_deal'), { record_ids: [renewal] }),
    );
    expect(reply.results).toEqual([{ id: renewal, label: 'Renewal' }]);
    expect(
      ok(
        await owner.put(links('deal', renewal, 'contact_deal'), { record_ids: [ada, grace] }),
      ).results.map((r: { label: string }) => r.label),
    ).toEqual(['Ada Lovelace', 'Grace Hopper']);
  });

  it('replaces the set, so what is left out is unlinked', async () => {
    ok(await owner.put(links('contact', ada, 'contact_company'), { record_ids: [globex] }));
    expect(ids(ok(await owner.get(links('contact', ada, 'contact_company'))))).toEqual([globex]);
    expect(ids(ok(await owner.get(links('company', acme, 'contact_company'))))).toEqual([grace]);
    ok(await owner.put(links('contact', ada, 'contact_company'), { record_ids: [] }));
    expect(ids(ok(await owner.get(links('contact', ada, 'contact_company'))))).toEqual([]);
  });

  it('links and unlinks one at a time, and linking twice changes nothing', async () => {
    ok(await owner.post(links('contact', ada, 'contact_company'), { record_id: acme }));
    ok(await owner.post(links('contact', ada, 'contact_company'), { record_id: acme }));
    ok(await owner.post(links('contact', ada, 'contact_company'), { record_id: globex }));
    expect(ids(ok(await owner.get(links('contact', ada, 'contact_company'))))).toEqual([
      acme,
      globex,
    ]);

    ok(await owner.del(links('contact', ada, 'contact_company', acme)));
    expect(ids(ok(await owner.get(links('contact', ada, 'contact_company'))))).toEqual([globex]);
    expect((await owner.del(links('contact', ada, 'contact_company', acme))).status).toBe(404); // no longer linked
  });

  it('pages through the links', async () => {
    ok(await owner.put(links('contact', ada, 'contact_company'), { record_ids: [] }));
    ok(await owner.put(links('contact', ada, 'contact_company'), { record_ids: [acme, globex] })); // linked together, so oldest-first ties break by id
    const first = ok(
      await owner.get(`${links('contact', ada, 'contact_company')}?page=1&page_size=1`),
    );
    expect(ids(first)).toEqual([acme]);
    expect(first.metadata).toMatchObject({ total_elements: 2, total_pages: 2, has_next: true });
    expect(
      ids(ok(await owner.get(`${links('contact', ada, 'contact_company')}?page=2&page_size=1`))),
    ).toEqual([globex]);
  });

  it('only links kinds of record that can be linked, to records that exist', async () => {
    expect((await owner.get(links('contact', ada, 'deal_company'))).status).toBe(404); // a link contacts are not an end of
    expect((await owner.get(links('contact', ada, 'nothing'))).status).toBe(404);
    expect(
      (await owner.put(links('contact', ada, 'contact_company'), { record_ids: ['999999999'] }))
        .status,
    ).toBe(404);
    expect(
      (await owner.put(links('contact', ada, 'contact_company'), { record_ids: [renewal] })).status,
    ).toBe(404); // a deal is not a company
    expect(
      (await owner.put(links('contact', ada, 'contact_company'), { record_ids: 'x' })).status,
    ).toBe(400);
    expect(sorted(ids(ok(await owner.get(links('contact', ada, 'contact_company')))))).toEqual(
      sorted([acme, globex]),
    ); // nothing half-applied
  });

  it('keeps organizations apart', async () => {
    expect((await eve.get(links('contact', ada, 'contact_company'))).status).toBe(404);
    expect(
      (await eve.put(links('contact', ada, 'contact_company'), { record_ids: [acme] })).status,
    ).toBe(404);
  });
});

describe('what a person may link', () => {
  let aliceContact: string;
  let aliceCompany: string;
  let bobContact: string;

  it('needs the right to change the record, and to see the record it is linked to', async () => {
    aliceContact = await create(alice, 'contact', { first_name: 'Alice', last_name: 'Contact' });
    aliceCompany = await create(alice, 'company', { name: 'Alice Co' });
    bobContact = await create(bob, 'contact', { first_name: 'Bob', last_name: 'Contact' });

    ok(
      await alice.put(links('contact', aliceContact, 'contact_company'), {
        record_ids: [aliceCompany],
      }),
    );
    expect(
      (
        await alice.put(links('contact', aliceContact, 'contact_company'), {
          record_ids: [aliceCompany, acme],
        })
      ).status,
    ).toBe(404); // the owner's company is not hers to see
    expect(
      (
        await alice.put(links('contact', bobContact, 'contact_company'), {
          record_ids: [aliceCompany],
        })
      ).status,
    ).toBe(404); // nor is Bob's contact
    expect((await alice.get(links('contact', bobContact, 'contact_company'))).status).toBe(404);
  });

  it('shows only the linked records the person may see, and leaves the others linked', async () => {
    // The owner links Alice's contact to a company Alice cannot see.
    ok(await owner.post(links('contact', aliceContact, 'contact_company'), { record_id: acme }));
    expect(ids(ok(await alice.get(links('contact', aliceContact, 'contact_company'))))).toEqual([
      aliceCompany,
    ]);
    expect(
      sorted(ids(ok(await owner.get(links('contact', aliceContact, 'contact_company'))))),
    ).toEqual(sorted([aliceCompany, acme]));

    // Alice replacing her view of the set does not touch what she cannot see.
    ok(await alice.put(links('contact', aliceContact, 'contact_company'), { record_ids: [] }));
    expect(ids(ok(await owner.get(links('contact', aliceContact, 'contact_company'))))).toEqual([
      acme,
    ]);
    ok(
      await alice.put(links('contact', aliceContact, 'contact_company'), {
        record_ids: [aliceCompany],
      }),
    );
  });

  it('applies the same limits to the names shown beside each record', async () => {
    const mine = ok(await alice.get(`${rec('contact')}?include=associations&page_size=100`))
      .results as { id: string; associations: Record<string, { label: string }[]> }[];
    expect(mine.map((r) => r.id)).toEqual([aliceContact]);
    expect(mine[0].associations.contact_company.map((c) => c.label)).toEqual(['Alice Co']); // not Analytical Engines
    const all = ok(await owner.get(`${rec('contact')}?include=associations&page_size=100`))
      .results as typeof mine;
    expect(
      all
        .find((r) => r.id === aliceContact)
        ?.associations.contact_company.map((c) => c.label)
        .sort(),
    ).toEqual(['Alice Co', 'Analytical Engines']);
  });
});

describe('linking several at once', () => {
  const unlinkMany = (user: User, object: string, id: string, link: string, record_ids: unknown) =>
    user.post(`${links(object, id, link)}/unlink`, { record_ids });
  let people: string[]; // contacts
  let firms: string[]; // companies

  beforeAll(async () => {
    people = [];
    firms = [];
    for (const name of ['Bulk1', 'Bulk2', 'Bulk3']) {
      people.push(await create(owner, 'contact', { first_name: name }));
      firms.push(await create(owner, 'company', { name: `${name} Co` }));
    }
  });

  it('adds many to one record, keeping what is there and ignoring repeats', async () => {
    ok(await owner.post(links('company', firms[0], 'contact_company'), { record_id: people[0] }));
    const reply = ok(
      await owner.post(links('company', firms[0], 'contact_company'), {
        record_ids: [people[1], people[2], people[1], people[0]],
      }),
    );
    // The answer is the records it was given, once each, not everything now linked.
    expect(ids(reply)).toEqual([people[1], people[2], people[0]]);
    expect(sorted(ids(ok(await owner.get(links('company', firms[0], 'contact_company')))))).toEqual(
      sorted(people),
    );
    // Seen from each contact.
    expect(ids(ok(await owner.get(links('contact', people[2], 'contact_company'))))).toEqual([
      firms[0],
    ]);
    // Again: nothing changes.
    ok(await owner.post(links('company', firms[0], 'contact_company'), { record_ids: people }));
    expect(ok(await owner.get(links('company', firms[0], 'contact_company'))).metadata.total_elements).toBe(3);
  });

  it('adds from the record that holds the link field too', async () => {
    ok(
      await owner.post(links('contact', people[0], 'contact_company'), {
        record_ids: [firms[1], firms[2]],
      }),
    );
    expect(sorted(ids(ok(await owner.get(links('contact', people[0], 'contact_company')))))).toEqual(
      sorted([firms[0], firms[1], firms[2]]),
    );
  });

  it('applies all of them or none', async () => {
    const before = ids(ok(await owner.get(links('company', firms[1], 'contact_company'))));
    for (const bad of ['999999999', renewal]) {
      const reply = await owner.post(links('company', firms[1], 'contact_company'), {
        record_ids: [people[1], bad, people[2]],
      });
      expect(reply.status).toBe(404); // missing, or a deal where a contact is needed
      expect(JSON.stringify(reply.data)).toContain(bad);
    }
    expect(ids(ok(await owner.get(links('company', firms[1], 'contact_company'))))).toEqual(before);
  });

  it('refuses a list that is empty, too long, malformed, or sent with record_id', async () => {
    const url = links('company', firms[1], 'contact_company');
    expect((await owner.post(url, { record_ids: [] })).status).toBe(400);
    expect((await owner.post(url, { record_ids: 'x' })).status).toBe(400);
    expect((await owner.post(url, { record_ids: ['abc'] })).status).toBe(404); // an id that cannot exist, as for one id
    expect((await owner.post(url, { record_id: people[1], record_ids: [people[2]] })).status).toBe(400);
    expect((await owner.post(url, {})).status).toBe(400);
    const tooMany = Array.from({ length: 501 }, (_, i) => String(i + 1));
    expect((await owner.post(url, { record_ids: tooMany })).status).toBe(400);
  });

  it('holds one record on a link that holds one, and refuses a list of two', async () => {
    const lead = await create(owner, 'lead', { first_name: 'Single' });
    const url = links('lead', lead, 'lead_contact');
    expect((await owner.post(url, { record_ids: [people[0], people[1]] })).status).toBe(400);
    expect(ids(ok(await owner.post(url, { record_ids: [people[0]] })))).toEqual([people[0]]);
    expect(ids(ok(await owner.get(url)))).toEqual([people[0]]);
  });

  it('keeps to what the person may see and change, and to their own organization', async () => {
    const mineCompany = await create(alice, 'company', { name: 'Alice Bulk Co' });
    const mineContact = await create(alice, 'contact', { first_name: 'Alice', last_name: 'Bulk' });
    ok(await alice.post(links('company', mineCompany, 'contact_company'), { record_ids: [mineContact] }));
    // One of the contacts is the owner's, which she cannot see: nothing is linked.
    expect(
      (
        await alice.post(links('company', mineCompany, 'contact_company'), {
          record_ids: [mineContact, people[2]],
        })
      ).status,
    ).toBe(404);
    // Nor can she add to the owner's company.
    expect(
      (await alice.post(links('company', firms[2], 'contact_company'), { record_ids: [mineContact] })).status,
    ).toBe(404);
    expect(ids(ok(await alice.get(links('company', mineCompany, 'contact_company'))))).toEqual([mineContact]);
    // Another organization sees none of it.
    expect((await eve.post(links('company', firms[0], 'contact_company'), { record_ids: people })).status).toBe(404);
    expect((await unlinkMany(eve, 'company', firms[0], 'contact_company', people)).status).toBe(404);
  });

  it('writes history for every record it touched', async () => {
    const hist = await create(owner, 'company', { name: 'HistBulk' });
    ok(await owner.post(links('company', hist, 'contact_company'), { record_ids: [people[0], people[1]] }));
    for (const person of [people[0], people[1]]) {
      const changes = (ok(await owner.get(`${rec('contact', person)}/history`)).results as {
        changes: Record<string, { old: unknown; new: unknown }>;
      }[]).flatMap((h) => (h.changes['associations.contact_company'] ? [h.changes['associations.contact_company']] : []));
      expect(changes.some((c) => c.new === hist)).toBe(true); // the other end records who linked it
    }
  });

  it('removes many at once, all or none', async () => {
    const url = links('company', firms[0], 'contact_company');
    // One of them is not linked: nothing is removed, and the answer says which.
    const stranger = await create(owner, 'contact', { first_name: 'Stranger' });
    const refused = await unlinkMany(owner, 'company', firms[0], 'contact_company', [people[0], stranger]);
    expect(refused.status).toBe(404);
    expect(JSON.stringify(refused.data)).toContain(stranger);
    expect(sorted(ids(ok(await owner.get(url))))).toEqual(sorted(people));

    const reply = ok(await unlinkMany(owner, 'company', firms[0], 'contact_company', [people[0], people[1]]));
    expect(sorted(ids(reply))).toEqual(sorted([people[0], people[1]]));
    expect(ids(ok(await owner.get(url)))).toEqual([people[2]]);
    // The records are still there.
    ok(await owner.get(rec('contact', people[0])));
    expect((await unlinkMany(owner, 'company', firms[0], 'contact_company', [])).status).toBe(400);
  });

  it('leaves links the person cannot see in place when removing', async () => {
    const mineContact = await create(alice, 'contact', { first_name: 'Alice', last_name: 'Keep' });
    const mineCompany = await create(alice, 'company', { name: 'Alice Keep Co' });
    ok(await alice.post(links('contact', mineContact, 'contact_company'), { record_ids: [mineCompany] }));
    ok(await owner.post(links('contact', mineContact, 'contact_company'), { record_id: firms[2] }));
    ok(await unlinkMany(alice, 'contact', mineContact, 'contact_company', [mineCompany]));
    expect(ids(ok(await owner.get(links('contact', mineContact, 'contact_company'))))).toEqual([firms[2]]);
    // She cannot name what she cannot see.
    expect((await unlinkMany(alice, 'contact', mineContact, 'contact_company', [firms[2]])).status).toBe(404);
  });
});

describe('showing links with the records', () => {
  it('adds who each record is linked to, by kind, to a list and to a search', async () => {
    const list = ok(
      await owner.get(`${rec('contact')}?include=associations&sort=first_name,asc&page_size=100`),
    ).results as { id: string; associations: Record<string, { id: string; label: string }[]> }[];
    const adaRow = list.find((r) => r.id === ada)!;
    expect(adaRow.associations.contact_company.map((c) => c.label).sort()).toEqual([
      'Analytical Engines',
      'Globex',
    ]);
    expect(adaRow.associations.contact_deal).toEqual([{ id: renewal, label: 'Renewal' }]);

    const found = ok(
      await owner.post(`${rec('contact')}/filter`, {
        filter_groups: [
          { filters: [{ field_path: 'first_name', operator: 'EQUALS', value: 'Grace' }] },
        ],
        include: ['associations'],
      }),
    );
    expect(
      found.results[0].associations.contact_company.map((c: { label: string }) => c.label),
    ).toEqual(['Analytical Engines']);
  });

  it('adds nothing unless asked', async () => {
    expect(ok(await owner.get(`${rec('contact')}?page_size=100`)).results[0]).not.toHaveProperty(
      'associations',
    );
  });

  it('gives a kind with no links an empty list, so a column can show it', async () => {
    const lonely = await create(owner, 'contact', { first_name: 'Lonely' });
    const row = ok(
      await owner.get(`${rec('contact')}?include=associations&page_size=100`),
    ).results.find((r: { id: string }) => r.id === lonely);
    expect(row.associations).toEqual({
      contact_company: [],
      contact_deal: [],
      lead_contact: [],
      contact_campaign: [],
    });
  });
});

describe('when a record goes away', () => {
  it('stops showing as linked, and is not counted', async () => {
    const doomed = await create(owner, 'company', { name: 'Doomed' });
    ok(await owner.post(links('contact', grace, 'contact_company'), { record_id: doomed }));
    expect(ids(ok(await owner.get(links('contact', grace, 'contact_company'))))).toContain(doomed);

    ok(await owner.del(rec('company', doomed)));
    expect(ids(ok(await owner.get(links('contact', grace, 'contact_company'))))).not.toContain(
      doomed,
    );
    expect(
      ok(await owner.get(links('contact', grace, 'contact_company'))).metadata.total_elements,
    ).toBe(1);
    const row = ok(
      await owner.get(`${rec('contact')}?include=associations&page_size=100`),
    ).results.find((r: { id: string }) => r.id === grace);
    expect(row.associations.contact_company.map((c: { label: string }) => c.label)).toEqual([
      'Analytical Engines',
    ]);
  });
});

describe('history', () => {
  it('records a change on both records', async () => {
    const x = await create(owner, 'contact', { first_name: 'Hist' });
    const y = await create(owner, 'company', { name: 'HistCo' });
    ok(await owner.post(links('contact', x, 'contact_company'), { record_id: y }));
    ok(await owner.del(links('contact', x, 'contact_company', y)));

    const mine = ok(await owner.get(`${rec('contact', x)}/history`)).results as {
      action: string;
      changes: Record<string, { old: unknown; new: unknown }>;
    }[];
    expect(
      mine
        .filter((h) => h.changes['associations.contact_company'])
        .map((h) => h.changes['associations.contact_company']),
    ).toEqual([
      { old: [y], new: [] },
      { old: [], new: [y] },
    ]);
    const theirs = ok(await owner.get(`${rec('company', y)}/history`)).results as typeof mine;
    expect(
      theirs
        .filter((h) => h.changes['associations.contact_company'])
        .map((h) => h.changes['associations.contact_company']),
    ).toEqual([
      { old: x, new: null },
      { old: null, new: x },
    ]);
  });
});

describe('link fields', () => {
  const FIELDS = (object: string) => `${API}/objects/${object}/fields`;
  const field = async (
    object: string,
    name: string,
    label: string,
    many: boolean,
    target = 'contact',
  ) =>
    ok(
      await owner.post(FIELDS(object), { name, label, type: 'LINK', config: { target, many } }),
      201,
    );
  const described = async (user: User, object: string) =>
    ok(await user.get(`${API}/objects/${object}`)) as {
      fields: { name: string; type: string }[];
      associations: Record<string, unknown>[];
      version: number;
    };

  let deal: string;
  let a: string;
  let b: string;

  it('lists the links that exist, and how many fields each object has', async () => {
    const results = ok(await owner.get(`${API}/associations`)).results as {
      name: string;
      label: string;
      many: boolean;
    }[];
    expect(results.map((d) => d.name)).toEqual([
      'contact_company',
      'contact_deal',
      'deal_company',
      'prospect_company',
      'lead_company',
      'prospect_lead',
      'lead_contact',
      'prospect_campaign',
      'lead_campaign',
      'contact_campaign',
      'company_campaign',
      'deal_campaign',
    ]);
    expect(results[0]).toMatchObject({ label: 'Companies', many: true });
    expect(
      ok(await owner.get(`${API}/objects`)).results.find(
        (o: { name: string }) => o.name === 'contact',
      ).field_count,
    ).toBe(9); // six fields and three links
  });

  it('adds a link field that holds one record, and shows it on both objects', async () => {
    const made = await field('deal', 'primary_contact', 'Primary contact', false);
    expect(made).toMatchObject({
      type: 'LINK',
      filterable: false,
      config: { link: 'deal_primary_contact', target: 'contact', many: false },
    });
    await field('deal', 'secondary_contact', 'Secondary contact', false);

    const onDeal = (await described(owner, 'deal')).associations.filter((x) => x['field'] !== null);
    expect(onDeal.find((x) => x['name'] === 'deal_primary_contact')).toEqual({
      name: 'deal_primary_contact',
      label: 'Primary contact',
      singular_label: 'Contact',
      target: 'contact',
      many: false,
      side: 'forward',
      field: 'primary_contact',
    });
    const onContact = (await described(owner, 'contact')).associations.find(
      (x) => x['name'] === 'deal_secondary_contact',
    );
    expect(onContact).toEqual({
      name: 'deal_secondary_contact',
      label: 'Deals (Secondary contact)',
      singular_label: 'Deal',
      target: 'deal',
      many: true,
      side: 'reverse',
      field: null,
    });
    expect((await described(owner, 'deal')).fields.map((f) => f.name)).toContain('primary_contact');
  });

  it('keeps one record, replacing it when another is linked, and refuses two', async () => {
    deal = await create(owner, 'deal', { name: 'Big deal' });
    a = await create(owner, 'contact', { first_name: 'Primary' });
    b = await create(owner, 'contact', { first_name: 'Secondary' });
    const LINK = 'deal_primary_contact';

    expect(ids(ok(await owner.post(links('deal', deal, LINK), { record_id: a })))).toEqual([a]);
    expect(ids(ok(await owner.post(links('deal', deal, LINK), { record_id: b })))).toEqual([b]); // replaces
    expect(ids(ok(await owner.get(links('deal', deal, LINK))))).toEqual([b]);
    const two = await owner.put(links('deal', deal, LINK), { record_ids: [a, b] });
    expect(two.status).toBe(400);
    expect(two.data.errors[0].field).toBe('record_ids');
    expect(ids(ok(await owner.put(links('deal', deal, LINK), { record_ids: [a] })))).toEqual([a]);
    expect(ids(ok(await owner.put(links('deal', deal, LINK), { record_ids: [] })))).toEqual([]);
  });

  it('keeps each link independent: a deal has a primary and a secondary contact', async () => {
    ok(await owner.post(links('deal', deal, 'deal_primary_contact'), { record_id: a }));
    ok(await owner.post(links('deal', deal, 'deal_secondary_contact'), { record_id: b }));
    const row = ok(
      await owner.get(`${rec('deal')}?include=associations&page_size=100`),
    ).results.find((r: { id: string }) => r.id === deal);
    expect(row.associations.deal_primary_contact.map((c: { label: string }) => c.label)).toEqual([
      'Primary',
    ]);
    expect(row.associations.deal_secondary_contact.map((c: { label: string }) => c.label)).toEqual([
      'Secondary',
    ]);
    // From the contact's side: the deals it holds each role on.
    expect(ids(ok(await owner.get(links('contact', a, 'deal_primary_contact'))))).toEqual([deal]);
    expect(ids(ok(await owner.get(links('contact', a, 'deal_secondary_contact'))))).toEqual([]);
  });

  it('takes a deal from its old primary contact when another contact is made primary from their side', async () => {
    // Contact b takes over as primary: a loses the deal, b gains it, in one step.
    ok(await owner.post(links('contact', b, 'deal_primary_contact'), { record_id: deal }));
    expect(ids(ok(await owner.get(links('deal', deal, 'deal_primary_contact'))))).toEqual([b]);
    expect(ids(ok(await owner.get(links('contact', a, 'deal_primary_contact'))))).toEqual([]);
    expect(ids(ok(await owner.get(links('contact', b, 'deal_primary_contact'))))).toEqual([deal]);
    const history = ok(await owner.get(`${rec('deal', deal)}/history`)).results as {
      changes: Record<string, { old: unknown; new: unknown }>;
    }[];
    expect(history[0].changes['associations.deal_primary_contact']).toEqual({ old: a, new: b });
  });

  it('allows one to become many, and many to become one only when nobody holds several', async () => {
    expect(
      ok(await owner.patch(`${FIELDS('deal')}/primary_contact`, { config: { many: true } })).config
        .many,
    ).toBe(true);
    ok(await owner.put(links('deal', deal, 'deal_primary_contact'), { record_ids: [a, b] }));
    const refused = await owner.patch(`${FIELDS('deal')}/primary_contact`, {
      config: { many: false },
    });
    expect(refused.status).toBe(409);
    expect(refused.data.message).toMatch(/1 records are linked to more than one/);
    ok(await owner.put(links('deal', deal, 'deal_primary_contact'), { record_ids: [b] }));
    expect(
      ok(await owner.patch(`${FIELDS('deal')}/primary_contact`, { config: { many: false } })).config
        .many,
    ).toBe(false);
  });

  it('is for people who manage the schema, and needs a real, different target', async () => {
    expect(
      (
        await alice.post(FIELDS('deal'), {
          name: 'x',
          label: 'X',
          type: 'LINK',
          config: { target: 'contact' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await owner.post(FIELDS('deal'), {
          name: 'self',
          label: 'Self',
          type: 'LINK',
          config: { target: 'deal' },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await owner.post(FIELDS('deal'), {
          name: 'ghost',
          label: 'Ghost',
          type: 'LINK',
          config: { target: 'nothing' },
        })
      ).status,
    ).toBe(404);
    expect(
      (await owner.post(FIELDS('deal'), { name: 'bare', label: 'Bare', type: 'LINK' })).status,
    ).toBe(400);
    expect(
      (
        await owner.post(FIELDS('deal'), {
          name: 'req',
          label: 'Req',
          type: 'LINK',
          required: true,
          config: { target: 'contact' },
        })
      ).status,
    ).toBe(400);
  });

  it("is not set through a record's properties", async () => {
    const reply = await owner.patch(rec('deal', deal), { properties: { primary_contact: a } });
    expect(reply.status).toBe(400);
    expect(reply.data.errors[0]).toMatchObject({ field: 'primary_contact', code: 'INVALID_FIELD' });
  });

  it('hides a removed link, and brings its links back when it is added again', async () => {
    ok(await owner.del(`${FIELDS('deal')}/secondary_contact`));
    expect((await owner.get(links('deal', deal, 'deal_secondary_contact'))).status).toBe(404);
    expect((await described(owner, 'contact')).associations.map((x) => x['name'])).not.toContain(
      'deal_secondary_contact',
    );

    expect(
      (
        await owner.post(FIELDS('deal'), {
          name: 'secondary_contact',
          label: 'Other',
          type: 'LINK',
          config: { target: 'company' },
        })
      ).status,
    ).toBe(409); // not the same target
    await field('deal', 'secondary_contact', 'Secondary contact', false);
    expect(ids(ok(await owner.get(links('deal', deal, 'deal_secondary_contact'))))).toEqual([b]);
  });

  it('works between custom objects, with a link field of many', async () => {
    for (const [slug, label] of [
      ['project', 'Project'],
      ['task', 'Task'],
    ]) {
      ok(await owner.post(`${API}/objects`, { slug, label }), 201);
      ok(
        await owner.post(FIELDS(slug), {
          name: 'name',
          label: 'Name',
          type: 'TEXT',
          required: true,
          filterable: true,
        }),
        201,
      );
    }
    await field('project', 'tasks', 'Tasks', true, 'task');
    const project = await create(owner, 'project', { name: 'Launch' });
    const tasks = [
      await create(owner, 'task', { name: 'Write' }),
      await create(owner, 'task', { name: 'Ship' }),
    ];
    ok(await owner.put(links('project', project, 'project_tasks'), { record_ids: tasks }));
    expect(ids(ok(await owner.get(links('task', tasks[0], 'project_tasks'))))).toEqual([project]);
    expect((await described(owner, 'task')).associations).toEqual([
      {
        name: 'project_tasks',
        label: 'Projects (Tasks)',
        singular_label: 'Project',
        target: 'project',
        many: true,
        side: 'reverse',
        field: null,
      },
    ]);
  });

  it('keeps organizations apart', async () => {
    expect((await eve.get(links('deal', deal, 'deal_primary_contact'))).status).toBe(404);
    expect((await described(eve, 'deal')).associations.map((x) => x['name'])).toEqual([
      'contact_deal',
      'deal_company',
      'deal_campaign',
    ]);
  });
});

describe('user fields', () => {
  const FIELDS = `${API}/objects/deal/fields`;
  let deal: string;

  it('holds a member, one or several', async () => {
    const one = ok(
      await owner.post(FIELDS, {
        name: 'account_manager',
        label: 'Account manager',
        type: 'USER',
        filterable: true,
      }),
      201,
    );
    expect(one).toMatchObject({ type: 'USER', filterable: true, config: { many: false } });
    const many = ok(
      await owner.post(FIELDS, {
        name: 'engineers',
        label: 'Engineers',
        type: 'USER',
        filterable: true,
        config: { many: true },
      }),
      201,
    );
    expect(many).toMatchObject({ filterable: false, config: { many: true } }); // a list cannot be filtered like a single value

    deal = await create(owner, 'deal', {
      name: 'With people',
      account_manager: owner.id,
      engineers: [owner.id, alice.id],
    });
    const got = ok(await owner.get(rec('deal', deal)));
    expect(got.properties).toMatchObject({
      account_manager: owner.id,
      engineers: [owner.id, alice.id],
    });
  });

  it('only takes members of the organization, in the right shape', async () => {
    const bad = async (properties: Record<string, unknown>) =>
      (await owner.patch(rec('deal', deal), { properties })).status;
    expect(await bad({ account_manager: eve.id })).toBe(400); // not a member here
    expect(await bad({ engineers: [owner.id, eve.id] })).toBe(400);
    expect(await bad({ account_manager: [owner.id] })).toBe(400); // one member, not a list
    expect(await bad({ engineers: owner.id })).toBe(400); // a list, not one member
    expect(await bad({ account_manager: 'abc' })).toBe(400);
    expect(await bad({ engineers: [] })).toBe(400);
    expect(
      ok(await owner.patch(rec('deal', deal), { properties: { account_manager: alice.id } }))
        .properties.account_manager,
    ).toBe(alice.id);
    expect(
      ok(await owner.patch(rec('deal', deal), { properties: { account_manager: null } }))
        .properties,
    ).not.toHaveProperty('account_manager');
  });

  it('can be searched by member when it holds one', async () => {
    ok(await owner.patch(rec('deal', deal), { properties: { account_manager: alice.id } }));
    const found = ok(
      await owner.post(`${rec('deal')}/filter`, {
        filter_groups: [
          { filters: [{ field_path: 'account_manager', operator: 'EQUALS', value: alice.id }] },
        ],
      }),
    );
    expect(ids(found)).toEqual([deal]);
  });

  it('changes between one and several, carrying the values over', async () => {
    const FIELD = `${FIELDS}/account_manager`;
    expect(ok(await owner.patch(FIELD, { config: { many: true } })).config.many).toBe(true);
    expect(ok(await owner.get(rec('deal', deal))).properties.account_manager).toEqual([alice.id]); // one became a list of one
    ok(
      await owner.patch(rec('deal', deal), {
        properties: { account_manager: [owner.id, alice.id] },
      }),
    );
    const refused = await owner.patch(FIELD, { config: { many: false } });
    expect(refused.status).toBe(409);
    ok(await owner.patch(rec('deal', deal), { properties: { account_manager: [alice.id] } }));
    expect(ok(await owner.patch(FIELD, { config: { many: false } })).config.many).toBe(false);
    expect(ok(await owner.get(rec('deal', deal))).properties.account_manager).toBe(alice.id); // back to one
  });
});

describe('restoring standard link fields', () => {
  it.each([
    ['contact', 'companies', 'company', 'contact_company'],
    ['contact', 'deals', 'deal', 'contact_deal'],
    ['deal', 'companies', 'company', 'deal_company'],
  ])(
    'restores %s.%s with its original definition and relationships',
    async (source, field, target, name) => {
      const record = await create(
        owner,
        source,
        source === 'contact' ? { first_name: 'Restore' } : { name: 'Restore' },
      );
      const other = await create(owner, target, { name: 'Retained link' });
      ok(await owner.post(links(source, record, name), { record_id: other }));
      const definitions = () =>
        owner
          .get(`${API}/associations`)
          .then((reply) => ok(reply).results as { id: string; name: string }[]);
      const original = (await definitions()).find((definition) => definition.name === name)!;
      const fields = `${API}/objects/${source}/fields`;
      ok(await owner.del(`${fields}/${field}`));
      expect((await owner.get(links(source, record, name))).status).toBe(404);

      // Reusing the key for another target must still be rejected, including for standard links.
      const wrongTarget = ['contact', 'company', 'deal'].find(
        (object) => object !== source && object !== target,
      )!;
      expect(
        (
          await owner.post(fields, {
            name: field,
            label: 'Restored',
            type: 'LINK',
            config: { target: wrongTarget },
          })
        ).status,
      ).toBe(409);
      const restored = ok(
        await owner.post(fields, {
          name: field,
          label: 'Restored',
          type: 'LINK',
          config: { target, many: true },
        }),
        201,
      );
      expect(restored.config.link).toBe(name);
      expect((await definitions()).find((definition) => definition.name === name)?.id).toBe(
        original.id,
      );
      expect(ids(ok(await owner.get(links(source, record, name))))).toEqual([other]);
      expect(ids(ok(await owner.get(links(target, other, name))))).toContain(record);
    },
  );
});
