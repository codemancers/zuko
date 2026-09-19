import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { Campaign, Organization, User } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ProspectsService } from './prospects.service';
import { ProspectsRepository } from '../repositories/prospects.repository';
import { LeadsRepository } from '../repositories/leads.repository';

describe('ProspectsService', () => {
  let service: ProspectsService;
  let prisma: PrismaClient;
  let org: Organization;
  let user: User;
  let campaign: Campaign;
  let otherCampaign: Campaign;

  const ORG_ID = 999_301;
  const OTHER_ORG_ID = 999_302;
  const TEST_USER_EMAIL = `prospect-actor-${ORG_ID}@example.com`;

  /** A prospect with an email, so it always has a contactable channel. */
  const newProspect = (overrides: Record<string, unknown> = {}) =>
    service.create(ORG_ID, {
      name: 'Ada Lovelace',
      email: `ada-${Math.random().toString(36).slice(2)}@example.com`,
      ...overrides,
    });

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    await prisma.$connect();

    const module = await Test.createTestingModule({
      providers: [
        ProspectsService,
        {
          provide: ProspectsRepository,
          useFactory: (p) => new ProspectsRepository(p),
          inject: ['PrismaService'],
        },
        {
          provide: LeadsRepository,
          useFactory: (p) => new LeadsRepository(p),
          inject: ['PrismaService'],
        },
        { provide: 'PrismaService', useValue: prisma },
      ],
    }).compile();

    service = module.get(ProspectsService);

    org = await prisma.organization.upsert({
      where: { id: ORG_ID },
      update: {},
      create: {
        id: ORG_ID,
        name: 'Test Org Prospects',
        slug: `test-org-${ORG_ID}`,
        createdAt: new Date(),
      },
    });

    await prisma.organization.upsert({
      where: { id: OTHER_ORG_ID },
      update: {},
      create: {
        id: OTHER_ORG_ID,
        name: 'Other Org Prospects',
        slug: `test-org-${OTHER_ORG_ID}`,
        createdAt: new Date(),
      },
    });

    user = await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      update: {},
      create: { name: `prospect-user-${ORG_ID}`, email: TEST_USER_EMAIL },
    });

    campaign = await prisma.campaign.create({
      data: {
        organizationId: ORG_ID,
        createdById: user.id,
        name: 'Q3 Outbound',
      },
    });

    otherCampaign = await prisma.campaign.create({
      data: {
        organizationId: ORG_ID,
        createdById: user.id,
        name: 'Q4 Outbound',
      },
    });
  });

  beforeEach(async () => {
    await prisma.campaignEvent.deleteMany({
      where: { prospect: { organizationId: { in: [ORG_ID, OTHER_ORG_ID] } } },
    });
    await prisma.campaignMembership.deleteMany({
      where: { prospect: { organizationId: { in: [ORG_ID, OTHER_ORG_ID] } } },
    });
    await prisma.prospect.deleteMany({
      where: { organizationId: { in: [ORG_ID, OTHER_ORG_ID] } },
    });
    await prisma.lead.deleteMany({
      where: { organizationId: { in: [ORG_ID, OTHER_ORG_ID] } },
    });
    await prisma.contact.deleteMany({
      where: { organizationId: { in: [ORG_ID, OTHER_ORG_ID] } },
    });
  });

  afterAll(async () => {
    try {
      await prisma.campaignEvent.deleteMany({
        where: { prospect: { organizationId: { in: [ORG_ID, OTHER_ORG_ID] } } },
      });
      await prisma.campaignMembership.deleteMany({
        where: { prospect: { organizationId: { in: [ORG_ID, OTHER_ORG_ID] } } },
      });
      await prisma.prospect.deleteMany({
        where: { organizationId: { in: [ORG_ID, OTHER_ORG_ID] } },
      });
      await prisma.lead.deleteMany({
        where: { organizationId: { in: [ORG_ID, OTHER_ORG_ID] } },
      });
      await prisma.contact.deleteMany({
        where: { organizationId: { in: [ORG_ID, OTHER_ORG_ID] } },
      });
      await prisma.campaign.deleteMany({
        where: { organizationId: { in: [ORG_ID, OTHER_ORG_ID] } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [ORG_ID, OTHER_ORG_ID] } },
      });
      await prisma.user.deleteMany({ where: { email: TEST_USER_EMAIL } });
    } catch (e) {
      console.warn('Cleanup failed:', e);
    }

    await prisma.$disconnect();
  });

  describe('identity resolution', () => {
    it('Creates a prospect in the new state', async () => {
      const prospect = await newProspect({ email: 'grace@example.com' });

      expect(prospect.status).toBe('new');
      expect(prospect.email).toBe('grace@example.com');
    });

    it('Enriches the existing record instead of creating a second prospect', async () => {
      const first = await service.create(ORG_ID, {
        name: 'Grace Hopper',
        email: 'grace@example.com',
      });

      const second = await service.create(ORG_ID, {
        name: 'Grace Hopper',
        email: 'grace@example.com',
        title: 'Rear Admiral',
        companyName: 'US Navy',
      });

      expect(second.id).toBe(first.id);
      expect(second.title).toBe('Rear Admiral');

      const all = await service.findAll(ORG_ID);
      expect(all.total).toBe(1);
    });

    it('Never overwrites what we already know with a later source', async () => {
      await service.create(ORG_ID, {
        name: 'Grace Hopper',
        email: 'grace@example.com',
        title: 'Rear Admiral',
      });

      const second = await service.create(ORG_ID, {
        name: 'G. Hopper',
        email: 'grace@example.com',
        title: 'Programmer',
      });

      expect(second.title).toBe('Rear Admiral');
    });

    it('Matches on the external identity ahead of email', async () => {
      const first = await service.create(ORG_ID, {
        name: 'Alan Turing',
        email: 'alan@example.com',
        externalType: 'apollo',
        externalId: 'person-123',
      });

      const second = await service.create(ORG_ID, {
        name: 'Alan Turing',
        email: 'alan.turing@example.com',
        externalType: 'apollo',
        externalId: 'person-123',
      });

      expect(second.id).toBe(first.id);
    });

    it('Treats the same id in different systems as different people', async () => {
      const apollo = await service.create(ORG_ID, {
        name: 'Apollo Person',
        email: 'from-apollo@example.com',
        externalType: 'apollo',
        externalId: 'shared-id-999',
      });

      const salesforce = await service.create(ORG_ID, {
        name: 'Salesforce Person',
        email: 'from-salesforce@example.com',
        externalType: 'salesforce',
        externalId: 'shared-id-999',
      });

      expect(salesforce.id).not.toBe(apollo.id);
      expect((await service.findAll(ORG_ID)).total).toBe(2);
    });

    it('Sources a prospect from any system without a schema change', async () => {
      for (const externalType of ['origami', 'salesforce', 'hubspot']) {
        const p = await service.create(ORG_ID, {
          name: `Person from ${externalType}`,
          email: `${externalType}@example.com`,
          externalType,
          externalId: `${externalType}-1`,
        });
        expect(p.externalType).toBe(externalType);
      }
    });

    it('Ignores a bare id with no system to interpret it', async () => {
      const first = await service.create(ORG_ID, {
        name: 'No System',
        email: 'nosystem-a@example.com',
        externalId: 'dangling-1',
      });
      const second = await service.create(ORG_ID, {
        name: 'No System Two',
        email: 'nosystem-b@example.com',
        externalId: 'dangling-1',
      });

      // Without externalType the id cannot be matched on, so these stay
      // separate people rather than being wrongly merged.
      expect(second.id).not.toBe(first.id);
    });

    it('Links to an existing CRM contact rather than shadowing it', async () => {
      const contact = await prisma.contact.create({
        data: {
          organizationId: ORG_ID,
          name: 'Existing Customer',
          email: 'customer@example.com',
        },
      });

      const prospect = await service.create(ORG_ID, {
        name: 'Existing Customer',
        email: 'customer@example.com',
      });

      expect(prospect.contactId).toBe(contact.id);
    });

    it('Keeps prospects of different organizations apart', async () => {
      await service.create(ORG_ID, {
        name: 'Shared Email',
        email: 'shared@example.com',
      });
      const other = await service.create(OTHER_ORG_ID, {
        name: 'Shared Email',
        email: 'shared@example.com',
      });

      expect(other.organizationId).toBe(OTHER_ORG_ID);
      expect((await service.findAll(ORG_ID)).total).toBe(1);
      expect((await service.findAll(OTHER_ORG_ID)).total).toBe(1);
    });
  });

  describe('enrolment', () => {
    it('Enrols a new prospect and moves it to enrolled', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);

      expect(membership.state).toBe('enrolled');
      expect(membership.engagement).toBe('not_contacted');
      expect(membership.disposition).toBeNull();

      const reloaded = await service.findById(prospect.id, ORG_ID);
      expect(reloaded.status).toBe('enrolled');
    });

    it('Records the enrolment as an event', async () => {
      const prospect = await newProspect();
      await service.enrol(prospect.id, ORG_ID, campaign.id);

      const events = await service.findEvents(prospect.id);
      expect(events.map((e) => e.eventType)).toEqual(['enrolled']);
    });

    it('Refuses a second open membership in the same campaign', async () => {
      const prospect = await newProspect();
      await service.enrol(prospect.id, ORG_ID, campaign.id);

      await expect(
        service.enrol(prospect.id, ORG_ID, campaign.id),
      ).rejects.toThrow(/already in campaign/);
    });

    it('Refuses to run a prospect in two campaigns at once', async () => {
      const prospect = await newProspect();
      await service.enrol(prospect.id, ORG_ID, campaign.id);

      await expect(
        service.enrol(prospect.id, ORG_ID, otherCampaign.id),
      ).rejects.toThrow(/already in an active campaign/);
    });

    it('Allows an override to enrol anyway', async () => {
      const prospect = await newProspect();
      await service.enrol(prospect.id, ORG_ID, campaign.id);

      const second = await service.enrol(
        prospect.id,
        ORG_ID,
        otherCampaign.id,
        { force: true },
      );

      expect(second.campaignId).toBe(otherCampaign.id);
    });

    it('Binds a membership to the channel it will use', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id, {
        channel: 'linkedin',
      });

      expect(membership.channel).toBe('linkedin');
    });

    it('Records who enrolled them and through what', async () => {
      const prospect = await newProspect();
      await service.enrol(prospect.id, ORG_ID, campaign.id, {
        actor: { userId: user.id, source: 'user' },
      });

      const events = await service.findEvents(prospect.id);
      expect(events[0].actorId).toBe(user.id);
      expect(events[0].source).toBe('user');
    });

    it('Refuses to enrol a suppressed prospect', async () => {
      const prospect = await newProspect();
      await service.suppress(prospect.id, ORG_ID);

      await expect(
        service.enrol(prospect.id, ORG_ID, campaign.id),
      ).rejects.toThrow(/cannot be enrolled/);
    });

    it('Refuses to enrol someone with no contactable channel', async () => {
      const prospect = await service.create(ORG_ID, { name: 'No Channels' });

      await expect(
        service.enrol(prospect.id, ORG_ID, campaign.id),
      ).rejects.toThrow(/no contactable channel/);
    });
  });

  describe('campaign events drive state', () => {
    it('Moves a membership to active and contacted as messages go out', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);

      await service.recordEvent(membership.id, ORG_ID, 'email_sent');
      const afterDelivery = await service.recordEvent(
        membership.id,
        ORG_ID,
        'email_delivered',
      );

      expect(afterDelivery?.state).toBe('active');
      expect(afterDelivery?.engagement).toBe('contacted');
    });

    it('Leaves state untouched on an open, because an open is not an answer', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);
      await service.recordEvent(membership.id, ORG_ID, 'email_sent');
      await service.recordEvent(membership.id, ORG_ID, 'email_delivered');

      const afterOpen = await service.recordEvent(
        membership.id,
        ORG_ID,
        'email_opened',
      );

      expect(afterOpen?.state).toBe('active');
      expect(afterOpen?.engagement).toBe('contacted');
    });

    it('Still records an open as history even though it changes nothing', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);
      await service.recordEvent(membership.id, ORG_ID, 'email_opened');

      const events = await service.findEvents(prospect.id);
      expect(events.map((e) => e.eventType)).toContain('email_opened');
    });

    it('Marks engagement responded on a reply, without concluding anything', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);
      await service.recordEvent(membership.id, ORG_ID, 'email_sent');
      await service.recordEvent(membership.id, ORG_ID, 'email_delivered');

      const replied = await service.recordEvent(
        membership.id,
        ORG_ID,
        'reply_received',
      );

      expect(replied?.engagement).toBe('responded');
      expect(replied?.disposition).toBeNull();

      const reloaded = await service.findById(prospect.id, ORG_ID);
      expect(reloaded.status).toBe('enrolled');
    });

    it('Treats a booked meeting as interest and engages the prospect', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);
      await service.recordEvent(membership.id, ORG_ID, 'email_sent');
      await service.recordEvent(membership.id, ORG_ID, 'email_delivered');
      await service.recordEvent(membership.id, ORG_ID, 'meeting_booked');

      const reloaded = await service.findById(prospect.id, ORG_ID);
      expect(reloaded.status).toBe('engaged');
    });

    it('Suppresses the prospect and revokes consent on an opt-out', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);
      const closed = await service.recordEvent(
        membership.id,
        ORG_ID,
        'opted_out',
      );

      expect(closed?.state).toBe('removed');
      expect(closed?.disposition).toBe('opted_out');

      const reloaded = await service.findById(prospect.id, ORG_ID);
      expect(reloaded.status).toBe('suppressed');
      expect(reloaded.emailConsent).toBe('revoked');
    });

    it('Marks a bounced recipient unreachable and closes the membership', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);
      const bounced = await service.recordEvent(
        membership.id,
        ORG_ID,
        'email_bounced',
      );

      expect(bounced?.engagement).toBe('unreachable');
      expect(bounced?.state).toBe('removed');

      const reloaded = await service.findById(prospect.id, ORG_ID);
      expect(reloaded.status).toBe('disqualified');
    });

    it('Applies a replayed provider event exactly once', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);

      await service.recordEvent(
        membership.id,
        ORG_ID,
        'email_delivered',
        undefined,
        'provider-evt-1',
      );
      await service.recordEvent(
        membership.id,
        ORG_ID,
        'email_delivered',
        undefined,
        'provider-evt-1',
      );

      const events = await service.findEvents(prospect.id);
      const delivered = events.filter((e) => e.eventType === 'email_delivered');
      expect(delivered).toHaveLength(1);
    });

    it('Rejects an event type that is not in the vocabulary', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);

      await expect(
        service.recordEvent(membership.id, ORG_ID, 'telepathy'),
      ).rejects.toThrow(/Unknown campaign event/);
    });

    it('Refuses to touch a membership belonging to another organization', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);

      await expect(
        service.recordEvent(membership.id, OTHER_ORG_ID, 'email_sent'),
      ).rejects.toThrow(/not found/);
    });
  });

  describe('outreach without a campaign', () => {
    it('Logs a phone call against a prospect that is in no campaign', async () => {
      const prospect = await newProspect({ phone: '+14155550001' });

      await service.recordDirectOutreach(
        prospect.id,
        ORG_ID,
        'call_placed',
        'phone',
        { userId: user.id, source: 'user' },
      );

      const events = await service.findEvents(prospect.id);
      expect(events[0].eventType).toBe('call_placed');
      expect(events[0].channel).toBe('phone');
      expect(events[0].membershipId).toBeNull();
    });

    it('Engages the prospect when a call is returned', async () => {
      const prospect = await newProspect({ phone: '+14155550002' });
      await service.recordDirectOutreach(
        prospect.id,
        ORG_ID,
        'call_connected',
        'phone',
      );
      const after = await service.recordDirectOutreach(
        prospect.id,
        ORG_ID,
        'reply_received',
        'phone',
      );

      expect(after.status).toBe('engaged');
    });

    it('Promotes from a direct call with no campaign anywhere in sight', async () => {
      const prospect = await newProspect({ phone: '+14155550003' });
      await service.recordDirectOutreach(
        prospect.id,
        ORG_ID,
        'reply_received',
        'phone',
      );

      const { lead } = await service.promote(prospect.id, ORG_ID);
      expect(lead.status).toBe('replied');
    });

    it('Refuses outbound on a revoked channel', async () => {
      const prospect = await newProspect({ phone: '+14155550004' });
      await service.setConsent(prospect.id, ORG_ID, 'phone', 'revoked');

      await expect(
        service.recordDirectOutreach(
          prospect.id,
          ORG_ID,
          'call_placed',
          'phone',
        ),
      ).rejects.toThrow(/consent revoked|no address/);
    });

    it('Refuses outbound on a channel with no address on file', async () => {
      const prospect = await newProspect();

      await expect(
        service.recordDirectOutreach(
          prospect.id,
          ORG_ID,
          'call_placed',
          'phone',
        ),
      ).rejects.toThrow(/no address/);
    });

    it('Still accepts an inbound reply on a revoked channel', async () => {
      const prospect = await newProspect({ phone: '+14155550005' });
      await service.setConsent(prospect.id, ORG_ID, 'phone', 'revoked');

      // They stopped us contacting them; they can still contact us.
      const after = await service.recordDirectOutreach(
        prospect.id,
        ORG_ID,
        'reply_received',
        'phone',
      );
      expect(after).toBeTruthy();
    });

    it('Refuses an event that does not belong to the channel', async () => {
      const prospect = await newProspect({ phone: '+14155550006' });

      await expect(
        service.recordDirectOutreach(
          prospect.id,
          ORG_ID,
          'email_opened',
          'phone',
        ),
      ).rejects.toThrow(/is a email event/);
    });
  });

  describe('per-channel opt-out', () => {
    it('Revokes only the channel the opt-out happened on', async () => {
      const prospect = await newProspect({ linkedinUrl: 'https://li/x' });
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id, {
        channel: 'email',
      });

      await service.recordEvent(membership.id, ORG_ID, 'opted_out');

      const after = await service.findById(prospect.id, ORG_ID);
      expect(after.emailConsent).toBe('revoked');
      // The documented rule: an email opt-out does not close LinkedIn.
      expect(after.linkedinConsent).toBe('unknown');
    });
  });

  describe('dispositions', () => {
    it('Returns a nurtured prospect to the pool, behind a cooldown', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);

      await service.setDisposition(membership.id, ORG_ID, 'nurture');

      const reloaded = await service.findById(prospect.id, ORG_ID);
      expect(reloaded.status).toBe('new');

      // Eligible again in principle, but not yet — silence earns a rest.
      await expect(
        service.enrol(prospect.id, ORG_ID, campaign.id),
      ).rejects.toThrow(/cooldown until/);
    });

    it('Honours an explicit re-eligibility date from a "not now" reply', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);
      const nextQuarter = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);

      await service.setDisposition(membership.id, ORG_ID, 'nurture', {
        nextEligibleAt: nextQuarter,
      });

      const stored = await prisma.campaignMembership.findUnique({
        where: { id: membership.id },
      });
      expect(stored?.nextEligibleAt?.toDateString()).toBe(
        nextQuarter.toDateString(),
      );
    });

    it('Lets a past cooldown lapse so the prospect is approachable again', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);
      await service.setDisposition(membership.id, ORG_ID, 'nurture');

      await prisma.campaignMembership.update({
        where: { id: membership.id },
        data: { nextEligibleAt: new Date(Date.now() - 1000) },
      });

      const reEnrolled = await service.enrol(prospect.id, ORG_ID, campaign.id);
      expect(reEnrolled.state).toBe('enrolled');
    });

    it('Disqualifies the prospect when a membership is ruled out', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);

      await service.setDisposition(membership.id, ORG_ID, 'disqualified');

      const reloaded = await service.findById(prospect.id, ORG_ID);
      expect(reloaded.status).toBe('disqualified');
    });

    it('Closes the membership when it is concluded', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);

      const closed = await service.setDisposition(
        membership.id,
        ORG_ID,
        'interested',
      );

      expect(closed.state).toBe('removed');
      expect(closed.closedAt).not.toBeNull();
    });

    it('Records who concluded the membership', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);

      await service.setDisposition(membership.id, ORG_ID, 'disqualified', {
        actor: { userId: user.id, source: 'user' },
      });

      const events = await service.findEvents(prospect.id);
      const closing = events.find((e) => e.eventType === 'removed');
      expect(closing?.actorId).toBe(user.id);
      expect(closing?.source).toBe('user');
    });

    it('Attributes a provider event to the provider, not to a person', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);

      await service.recordEvent(
        membership.id,
        ORG_ID,
        'email_delivered',
        undefined,
        'provider-evt-audit',
      );

      const events = await service.findEvents(prospect.id);
      const delivered = events.find((e) => e.eventType === 'email_delivered');
      expect(delivered?.source).toBe('provider');
      expect(delivered?.actorId).toBeNull();
    });

    it('Rejects a disposition outside the vocabulary', async () => {
      const prospect = await newProspect();
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);

      await expect(
        service.setDisposition(membership.id, ORG_ID, 'maybe_later'),
      ).rejects.toThrow(/Unknown disposition/);
    });
  });

  describe('promotion', () => {
    const engage = async () => {
      const prospect = await newProspect({ companyName: 'Analytical Engines' });
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);
      await service.setDisposition(membership.id, ORG_ID, 'interested');
      return prospect;
    };

    it('Creates a lead in the replied state and marks the prospect promoted', async () => {
      const prospect = await engage();
      const { lead, prospect: promoted } = await service.promote(
        prospect.id,
        ORG_ID,
      );

      expect(lead.status).toBe('replied');
      expect(lead.name).toBe(prospect.name);
      expect(promoted.status).toBe('promoted');
      expect(promoted.leadId).toBe(lead.id);
    });

    it('Refuses to promote a prospect that has not engaged', async () => {
      const prospect = await newProspect();

      await expect(service.promote(prospect.id, ORG_ID)).rejects.toThrow(
        /Only an engaged prospect/,
      );
    });

    it('Stops outbound by closing every open membership', async () => {
      const prospect = await newProspect();
      await service.enrol(prospect.id, ORG_ID, campaign.id);
      const second = await service.enrol(
        prospect.id,
        ORG_ID,
        otherCampaign.id,
        { force: true },
      );
      await service.setDisposition(second.id, ORG_ID, 'interested');

      await service.promote(prospect.id, ORG_ID);

      const memberships = await prisma.campaignMembership.findMany({
        where: { prospectId: prospect.id },
      });
      expect(memberships.every((m) => m.state === 'removed')).toBe(true);
    });

    it('Refuses to promote the same prospect twice, creating only one lead', async () => {
      const prospect = await engage();
      await service.promote(prospect.id, ORG_ID);

      // The status guard catches this first: a promoted prospect is no longer
      // engaged, so it never reaches the duplicate-lead check behind it.
      await expect(service.promote(prospect.id, ORG_ID)).rejects.toThrow(
        /Only an engaged prospect/,
      );

      const leads = await prisma.lead.count({
        where: { organizationId: ORG_ID },
      });
      expect(leads).toBe(1);
    });

    it('Carries the linked CRM contact onto the lead instead of duplicating it', async () => {
      const contact = await prisma.contact.create({
        data: {
          organizationId: ORG_ID,
          name: 'Known Customer',
          email: 'known@example.com',
        },
      });
      const prospect = await service.create(ORG_ID, {
        name: 'Known Customer',
        email: 'known@example.com',
      });
      const membership = await service.enrol(prospect.id, ORG_ID, campaign.id);
      await service.setDisposition(membership.id, ORG_ID, 'interested');

      const { lead } = await service.promote(prospect.id, ORG_ID);

      expect(lead.contactId).toBe(contact.id);
      const contacts = await prisma.contact.count({
        where: { organizationId: ORG_ID, email: 'known@example.com' },
      });
      expect(contacts).toBe(1);
    });

    it('Returns a demoted prospect to engaged', async () => {
      const prospect = await engage();
      await service.promote(prospect.id, ORG_ID);

      const demoted = await service.demote(prospect.id, ORG_ID);

      expect(demoted.status).toBe('engaged');
      expect(demoted.leadId).toBeNull();
    });
  });

  describe('consent and suppression', () => {
    it('Revokes one channel without silencing the others', async () => {
      const prospect = await newProspect({ linkedinUrl: 'https://li/ada' });

      const updated = await service.setConsent(
        prospect.id,
        ORG_ID,
        'email',
        'revoked',
      );

      expect(updated.emailConsent).toBe('revoked');
      expect(updated.linkedinConsent).toBe('unknown');
      expect(updated.status).not.toBe('suppressed');
    });

    it('Suppresses outright once the last channel is revoked', async () => {
      const prospect = await newProspect();

      const updated = await service.setConsent(
        prospect.id,
        ORG_ID,
        'email',
        'revoked',
      );

      expect(updated.status).toBe('suppressed');
    });

    it('Stops every running campaign when a prospect is suppressed', async () => {
      const prospect = await newProspect();
      await service.enrol(prospect.id, ORG_ID, campaign.id);

      await service.suppress(prospect.id, ORG_ID);

      const memberships = await prisma.campaignMembership.findMany({
        where: { prospectId: prospect.id },
      });
      expect(memberships.every((m) => m.state === 'removed')).toBe(true);
    });

    it('Rejects an unknown channel or consent value', async () => {
      const prospect = await newProspect();

      await expect(
        service.setConsent(prospect.id, ORG_ID, 'carrier_pigeon', 'revoked'),
      ).rejects.toThrow(/Unknown channel/);
      await expect(
        service.setConsent(prospect.id, ORG_ID, 'email', 'maybe'),
      ).rejects.toThrow(/Unknown consent/);
    });
  });

  describe('status transitions', () => {
    it('Refuses a transition the lifecycle does not allow', async () => {
      const prospect = await newProspect();

      await expect(
        service.setStatus(prospect.id, ORG_ID, 'promoted'),
      ).rejects.toThrow(/Cannot move a prospect/);
    });

    it('Refuses to lift suppression without an explicit manual action', async () => {
      const prospect = await newProspect();
      await service.suppress(prospect.id, ORG_ID);

      await expect(
        service.setStatus(prospect.id, ORG_ID, 'new'),
      ).rejects.toThrow(/requires an explicit manual action/);

      const revived = await service.setStatus(prospect.id, ORG_ID, 'new', {
        manual: true,
      });
      expect(revived.status).toBe('new');
    });

    it('Rejects a status that does not exist', async () => {
      const prospect = await newProspect();

      await expect(
        service.setStatus(prospect.id, ORG_ID, 'vibing'),
      ).rejects.toThrow(/Unknown prospect status/);
    });

    it('Refuses to set status through the generic update path', async () => {
      const prospect = await newProspect();

      await expect(
        service.update(prospect.id, ORG_ID, { status: 'promoted' }),
      ).rejects.toThrow(/Use setStatus/);
    });

    it('Refuses to read a prospect from another organization', async () => {
      const prospect = await newProspect();

      await expect(service.findById(prospect.id, OTHER_ORG_ID)).rejects.toThrow(
        /not found/,
      );
    });
  });

  describe('listing', () => {
    it('Filters by status and by campaign', async () => {
      const enrolled = await newProspect();
      await service.enrol(enrolled.id, ORG_ID, campaign.id);
      await newProspect();

      const byStatus = await service.findAll(ORG_ID, { status: ['enrolled'] });
      expect(byStatus.total).toBe(1);
      expect(byStatus.data[0].id).toBe(enrolled.id);

      const byCampaign = await service.findAll(ORG_ID, {
        campaignId: campaign.id,
      });
      expect(byCampaign.total).toBe(1);
    });

    it('Counts prospects by status', async () => {
      const enrolled = await newProspect();
      await service.enrol(enrolled.id, ORG_ID, campaign.id);
      await newProspect();

      const counts = await service.countByStatus(ORG_ID);
      const asMap = Object.fromEntries(counts.map((c) => [c.status, c.count]));

      expect(asMap['enrolled']).toBe(1);
      expect(asMap['new']).toBe(1);
    });
  });

  it('Keeps the organization fixture intact for the suite', () => {
    expect(org.id).toBe(ORG_ID);
  });
});
