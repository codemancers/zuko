/**
 * E2E seed: creates a fixed test user and owned sales data.
 * Run before E2E (e.g. in CI after migrate deploy). Auth setup signs in as this user.
 *
 * Usage: npx prisma db seed (from libs/models) or nx run @zuko/models:seed
 *
 * Prisma v7 requires a driver adapter: https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding
 */

import * as path from "node:path";
import * as crypto from "node:crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const E2E_USER_EMAIL = "e2e@example.com";
const E2E_USER_NAME = "E2E Test User";
const E2E_USER_PASSWORD = "TestPassword123!";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("base64")}:${key.toString("base64")}`;
}

async function main() {
  const user = await prisma.user.upsert({
    where: { email: E2E_USER_EMAIL },
    create: {
      name: E2E_USER_NAME,
      email: E2E_USER_EMAIL,
      emailVerified: true,
    },
    update: {},
  });

  const hashed = hashPassword(E2E_USER_PASSWORD);
  const existing = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (existing) {
    await prisma.account.update({
      where: { id: existing.id },
      data: { password: hashed },
    });
  } else {
    await prisma.account.create({
      data: {
        accountId: E2E_USER_EMAIL,
        providerId: "credential",
        userId: user.id,
        password: hashed,
      },
    });
  }

  // Organization required for sales entities (contacts, companies, deals)
  const org = await prisma.organization.upsert({
    where: { slug: "e2e-org" },
    create: {
      name: "E2E Org",
      slug: "e2e-org",
      createdAt: new Date(),
    },
    update: {},
  });

  const existingMember = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: user.id },
  });
  if (!existingMember) {
    await prisma.member.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: "member",
        createdAt: new Date(),
      },
    });
  }

  const company1 = await prisma.salesCompany.upsert({
    where: { id: 1 },
    create: {
      organizationId: org.id,
      companyName: "TEST COMPANY",
      website: "https://test-company.example.com",
      linkedinUrl: "https://linkedin.com/company/test-company",
      summary: "TEST COMPANY SUMMARY",
      owners: {
        create: { userId: user.id, isPrimary: true },
      },
    },
    update: {},
    include: { owners: true },
  });

  const contact1 = await prisma.contact.upsert({
    where: { id: 1 },
    create: {
      organizationId: org.id,
      name: "TEST CONTACT",
      email: "test-contact@example.com",
      phone: "+14155551234",
      notes: "TEST CONTACT NOTES",
      owners: {
        create: { userId: user.id, isPrimary: true },
      },
    },
    update: {},
  });

  await prisma.deal.upsert({
    where: { id: 1 },
    create: {
      organizationId: org.id,
      title: "TEST DEAL",
      value: 50000,
      currency: "USD",
      stage: "prospecting",
      summary: "TEST DEAL SUMMARY",
      source: "Website",
      priority: 2,
      owners: {
        create: { userId: user.id, isPrimary: true },
      },
    },
    update: {},
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
