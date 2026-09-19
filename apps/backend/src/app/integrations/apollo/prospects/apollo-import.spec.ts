import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApolloProspectsService } from './apollo-prospects.service';
import type { SequenceContact } from './apollo-prospects.service';

/**
 * Apollo is a source, not an owner. These tests pin the direction of that
 * dependency: everything it brings in lands on prospects, memberships and
 * touches, and nothing it does creates a lead.
 */

const contact = (over: Partial<SequenceContact> = {}): SequenceContact => ({
  id: 'apollo-contact-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  title: 'Engineer',
  organizationName: 'Analytical Engines',
  emailLabel: 'replied',
  ...over,
});

function build(contacts: SequenceContact[]) {
  const prospects = {
    create: vi.fn(async (_org: number, input: Record<string, unknown>) => ({
      id: 7,
      memberships: [],
      ...input,
    })),
    findById: vi.fn(async () => ({ id: 7, memberships: [] })),
    enrol: vi.fn(async () => ({ id: 33, campaignId: 4 })),
    recordEvent: vi.fn(async () => ({ id: 33 })),
  };

  const service = new ApolloProspectsService(
    {} as never,
    {} as never,
    {} as never,
    prospects as never,
  );
  vi.spyOn(service, 'getSequenceContacts').mockResolvedValue(contacts);

  return { service, prospects };
}

describe('Apollo import', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Imports a sequence contact as a prospect, stamped with its source', async () => {
    const { service, prospects } = build([contact()]);

    const result = await service.syncSequenceActivity(1, 'seq-1', 2, 4);

    expect(result.prospects).toBe(1);
    expect(prospects.create).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        name: 'Ada Lovelace',
        externalType: 'apollo',
        externalId: 'apollo-contact-1',
        icpProfileId: 2,
      }),
    );
  });

  it('Never creates a lead, even when the contact replied', async () => {
    const { service, prospects } = build([contact({ emailLabel: 'replied' })]);

    await service.syncSequenceActivity(1, 'seq-1', undefined, 4);

    // Promotion is a judgement someone makes — "no thanks" is a reply too.
    const created = prospects.create.mock.calls.map((c) => c[1]);
    expect(created.every((input) => !('status' in input))).toBe(true);
    expect(prospects.recordEvent).toHaveBeenCalledWith(
      33,
      1,
      'reply_received',
      undefined,
      expect.any(String),
      undefined,
      { source: 'provider' },
    );
  });

  it('Records the enrolment as a membership on the Zuko campaign', async () => {
    const { service, prospects } = build([contact()]);

    const result = await service.syncSequenceActivity(1, 'seq-1', undefined, 4);

    expect(result.enrolled).toBe(1);
    expect(prospects.enrol).toHaveBeenCalledWith(
      7,
      1,
      4,
      expect.objectContaining({
        force: true,
        actor: { source: 'provider' },
      }),
    );
  });

  it('Translates Apollo labels into the domain vocabulary', async () => {
    const cases: [string, string[]][] = [
      ['bounced', ['email_bounced']],
      ['opened', ['email_delivered', 'email_opened']],
      ['clicked', ['email_delivered', 'email_clicked']],
      ['replied', ['email_delivered', 'reply_received']],
    ];

    for (const [label, expected] of cases) {
      const { service, prospects } = build([contact({ emailLabel: label })]);
      await service.syncSequenceActivity(1, 'seq-1', undefined, 4);

      const recorded = prospects.recordEvent.mock.calls.map((c) => c[2]);
      expect(recorded).toEqual(expected);
    }
  });

  it('Attributes every touch to the provider, not to a person', async () => {
    const { service, prospects } = build([contact()]);

    await service.syncSequenceActivity(1, 'seq-1', undefined, 4);

    for (const call of prospects.recordEvent.mock.calls) {
      expect(call[6]).toEqual({ source: 'provider' });
    }
  });

  it('Keys each touch so a re-sync cannot double-count it', async () => {
    const { service, prospects } = build([contact()]);

    await service.syncSequenceActivity(1, 'seq-1', undefined, 4);

    const externalIds = prospects.recordEvent.mock.calls.map((c) => c[4]);
    expect(externalIds).toEqual([
      'apollo:seq-1:apollo-contact-1:email_delivered',
      'apollo:seq-1:apollo-contact-1:reply_received',
    ]);
    expect(new Set(externalIds).size).toBe(externalIds.length);
  });

  it('Imports the whole audience, not only the people who answered', async () => {
    const { service, prospects } = build([
      contact({ id: 'a', emailLabel: 'sent' }),
      contact({ id: 'b', emailLabel: 'replied' }),
      contact({ id: 'c', emailLabel: undefined }),
    ]);

    const result = await service.syncSequenceActivity(1, 'seq-1', undefined, 4);

    // The audience is the point: silence is data we could not record before.
    expect(result.prospects).toBe(3);
    expect(prospects.create).toHaveBeenCalledTimes(3);
  });

  it('Lets consent refuse an enrolment Apollo already made', async () => {
    const { service, prospects } = build([contact()]);
    prospects.enrol.mockRejectedValueOnce(new Error('Prospect is suppressed'));

    const result = await service.syncSequenceActivity(1, 'seq-1', undefined, 4);

    expect(result.enrolled).toBe(0);
    expect(prospects.recordEvent).not.toHaveBeenCalled();
  });

  it('Skips a contact with no Apollo id rather than inventing one', async () => {
    const { service, prospects } = build([contact({ id: '' })]);

    const result = await service.syncSequenceActivity(1, 'seq-1', undefined, 4);

    expect(result.skipped).toBe(1);
    expect(prospects.create).not.toHaveBeenCalled();
  });

  it('Imports prospects even with no campaign to enrol them into', async () => {
    const { service, prospects } = build([contact()]);

    const result = await service.syncSequenceActivity(1, 'seq-1');

    expect(result.prospects).toBe(1);
    expect(result.enrolled).toBe(0);
    expect(prospects.enrol).not.toHaveBeenCalled();
  });
});
