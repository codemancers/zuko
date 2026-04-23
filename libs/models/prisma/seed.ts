/**
 * E2E seed: creates a fixed test user and owned sales data.
 * Run before E2E (e.g. in CI after migrate deploy). Auth setup signs in as this user.
 *
 * Usage: npx prisma db seed (from libs/models) or nx run @zuko/models:seed
 *
 * Prisma v7 requires a driver adapter: https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding
 *
 * The E2E user is created via better-auth's signUpEmail so the password is hashed
 * in the format better-auth expects (same as production sign-in).
 */

import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const E2E_USER_EMAIL = 'e2e@example.com';
const E2E_USER_NAME = 'E2E Test User';
const E2E_USER_PASSWORD = 'TestPassword123!';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');
const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
if (!secret) throw new Error('BETTER_AUTH_SECRET or AUTH_SECRET is not set');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret,
  emailAndPassword: { enabled: true },
  advanced: {
    database: { generateId: 'serial' },
  },
});

async function main() {
  const signUpResult = await auth.api.signUpEmail({
    body: {
      name: E2E_USER_NAME,
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
    },
  });

  const result = signUpResult as { user: { id: number | string } };
  const userId =
    typeof result.user.id === 'string'
      ? parseInt(result.user.id, 10)
      : result.user.id;

  // Organization required for sales entities (contacts, companies, deals)
  const org = await prisma.organization.upsert({
    where: { slug: 'e2e-org' },
    create: {
      name: 'E2E Org',
      slug: 'e2e-org',
      createdAt: new Date(),
    },
    update: {},
  });

  const existingMember = await prisma.member.findFirst({
    where: { organizationId: org.id, userId },
  });
  if (!existingMember) {
    await prisma.member.create({
      data: {
        organizationId: org.id,
        userId,
        role: 'owner',
        createdAt: new Date(),
      },
    });
  }

  await prisma.company.upsert({
    where: { id: 1 },
    create: {
      organizationId: org.id,
      companyName: 'TEST COMPANY',
      website: 'https://test-company.example.com',
      linkedinUrl: 'https://linkedin.com/company/test-company',
      summary: 'TEST COMPANY SUMMARY',
      owners: {
        create: { userId, isPrimary: true },
      },
    },
    update: {},
  });

  await prisma.company.upsert({
    where: { id: 2 },
    create: {
      organizationId: org.id,
      companyName: 'TEST 2 COMPANY',
      website: 'https://test-company2.example.com',
      linkedinUrl: 'https://linkedin.com/company/test-company2',
      summary: 'TEST COMPANY SUMMARY2',
      owners: {
        create: { userId, isPrimary: true },
      },
    },
    update: {},
  });

  await prisma.contact.upsert({
    where: { id: 1 },
    create: {
      organizationId: org.id,
      name: 'TEST CONTACT',
      email: 'test-contact@example.com',
      phone: '+14155551234',
      notes: 'TEST CONTACT NOTES',
      owners: {
        create: { userId, isPrimary: true },
      },
    },
    update: {},
  });

  await prisma.contact.upsert({
    where: { id: 2 },
    create: {
      organizationId: org.id,
      name: 'TEST 2 CONTACT',
      email: 'test-contact2@example.com',
      phone: '+14155551235',
      notes: 'TEST CONTACT NOTES2',
      owners: {
        create: { userId, isPrimary: true },
      },
    },
    update: {},
  });

  await prisma.deal.upsert({
    where: { id: 1 },
    create: {
      organizationId: org.id,
      title: 'TEST DEAL',
      value: 50000,
      currency: 'USD',
      stage: 'prospecting',
      summary: 'TEST DEAL SUMMARY',
      source: 'Website',
      priority: 2,
      owners: {
        create: { userId, isPrimary: true },
      },
    },
    update: { stage: 'prospecting' },
  });

  await prisma.deal.upsert({
    where: { id: 2 },
    create: {
      organizationId: org.id,
      title: 'TEST 2 DEAL',
      value: 75000,
      currency: 'USD',
      stage: 'prospecting',
      summary: 'TEST DEAL SUMMARY2',
      source: 'Website',
      priority: 2,
      owners: {
        create: { userId, isPrimary: true },
      },
    },
    update: { stage: 'prospecting' },
  });

  const meeting = await prisma.meeting.upsert({
    where: { id: 1 },
    create: {
      organizationId: org.id,
      name: 'Weekly Product Sync',
      url: 'https://zoom.us/j/123456789',
      platform: 'ZOOM',
      status: 'COMPLETED',
      timezone: 'UTC',
      scheduledAt: new Date('2024-01-14T10:00:00Z'),
      createdBy: userId,
      // Points to the Next.js fixture endpoint so NestJS can fetch transcript
      // data during SSR without needing an external storage service in e2e.
      transcript: 'http://localhost:3000/api/fixtures/transcript',
    },
    update: {},
  });

  await prisma.meetingSummary.upsert({
    where: { id: 1 },
    create: {
      meetingId: meeting.id,
      content:
        'The team discussed the ongoing UI refactor and API documentation needs.',
    },
    update: {},
  });

  await prisma.meetingActionItem.upsert({
    where: { id: 1 },
    create: {
      meetingId: meeting.id,
      title: 'Review UI refactor components',
    },
    update: {},
  });

  await prisma.meetingActionItem.upsert({
    where: { id: 2 },
    create: {
      meetingId: meeting.id,
      title: 'Review API documentation',
    },
    update: {},
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
