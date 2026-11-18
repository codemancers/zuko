import { Client } from 'pg';
import { PrismaService } from './prisma.service';

// Real-database test; see core-data-model.spec.ts for how to set TEST_DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('datetimes are UTC', () => {
  let db: Client;
  const rows = async <T>(sql: string) => (await db.query(sql)).rows as T[];

  beforeAll(async () => {
    db = new Client({ connectionString: url });
    await db.connect();
  });
  afterAll(async () => {
    await db.end();
  });

  it('has no timezone-aware datetime columns', async () => {
    // Prisma's own migration bookkeeping table uses timestamptz; it is not ours to change.
    const aware = await rows<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
         AND data_type IN ('timestamp with time zone', 'time with time zone')`,
    );
    expect(aware).toEqual([]);
  });

  it('never defaults a datetime to the session\'s local time', async () => {
    const local = await rows<{ table_name: string; column_name: string; column_default: string }>(
      `SELECT table_name, column_name, column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
         AND column_default IS NOT NULL AND column_default NOT LIKE '%timezone(%utc%'`,
    );
    expect(local).toEqual([]);
  });

  it('defaults to UTC even when the session is in another timezone', async () => {
    await db.query('BEGIN');
    try {
      await db.query("SET LOCAL TIME ZONE 'Asia/Kolkata'"); // +05:30: a local-time default would be 19,800 seconds ahead
      const inserted = await rows<{ createdAt: Date }>(
        `INSERT INTO verification ("identifier", "value", "expiresAt", "updatedAt")
         VALUES ('utc-spec', 'x', timezone('utc', now()), timezone('utc', now())) RETURNING "createdAt"`,
      );
      const [{ skew }] = await rows<{ skew: number }>(
        `SELECT extract(epoch FROM ("createdAt" - timezone('utc', now()))) AS skew FROM verification WHERE "identifier" = 'utc-spec'`,
      );
      expect(inserted).toHaveLength(1);
      expect(Math.abs(Number(skew))).toBeLessThan(60);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('makes the database\'s own timezone UTC', async () => {
    const [{ TimeZone }] = await rows<{ TimeZone: string }>('SHOW timezone');
    expect(TimeZone).toBe('UTC');
  });

  it('keeps the application\'s own connections in UTC', async () => {
    const before = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    const prisma = new PrismaService();
    try {
      const [{ TimeZone }] = await prisma.$queryRaw<{ TimeZone: string }[]>`SHOW timezone`;
      expect(TimeZone).toBe('UTC');
    } finally {
      await prisma.$disconnect();
      process.env.DATABASE_URL = before;
    }
  });
});
