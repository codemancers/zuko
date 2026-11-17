import axios from 'axios';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { Client } from 'pg';

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });

const PASSWORD = 'correct-horse-battery-1';
const ORIGIN = process.env.FRONTEND_URL || 'http://localhost:4200';

export interface Reply {
  status: number;
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** A signed-in user: remembers the session cookie and sends it with every call. */
export class User {
  cookie = '';
  id = '';

  constructor(
    readonly name: string,
    readonly email: string,
  ) {}

  async call(method: string, url: string, data?: unknown): Promise<Reply> {
    const res = await axios.request({
      method,
      url,
      data,
      headers: { Origin: ORIGIN, ...(this.cookie ? { Cookie: this.cookie } : {}) },
      validateStatus: () => true,
    });
    const setCookie = res.headers['set-cookie'];
    if (setCookie?.length) {
      this.cookie = setCookie.map((c: string) => c.split(';')[0]).join('; ');
    }
    return { status: res.status, data: res.data };
  }

  get = (url: string) => this.call('GET', url);
  post = (url: string, data?: unknown) => this.call('POST', url, data);
  patch = (url: string, data?: unknown) => this.call('PATCH', url, data);
  put = (url: string, data?: unknown) => this.call('PUT', url, data);
  del = (url: string) => this.call('DELETE', url);

  async signUp() {
    const res = await this.post('/auth/sign-up/email', { name: this.name, email: this.email, password: PASSWORD });
    this.id = res.data?.user?.id;
    return res;
  }

  signIn() {
    return this.post('/auth/sign-in/email', { email: this.email, password: PASSWORD });
  }
}

/** Direct database access for what the API deliberately cannot do (verify emails, inspect audit, clean up). */
export async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

/** Remove everything a run created. Audit rows are append-only, so deletes need the purge flag. */
export async function cleanup(emailSuffix: string, orgSlugs: string[]) {
  await withDb(async (db) => {
    await db.query('BEGIN');
    await db.query("SELECT set_config('app.audit_purge', 'on', true)");
    await db.query(
      `DELETE FROM audit_event WHERE "organizationId" IN (SELECT id FROM organization WHERE slug = ANY($1))
         OR "actorId" IN (SELECT id FROM "user" WHERE email LIKE $2)
         OR metadata->>'email' LIKE $2`, // org-less events such as a failed sign-in
      [orgSlugs, `%${emailSuffix}`],
    );
    await db.query(
      'DELETE FROM record_change WHERE "organizationId" IN (SELECT id FROM organization WHERE slug = ANY($1))',
      [orgSlugs],
    );
    await db.query('COMMIT');
    await db.query('DELETE FROM object_record WHERE "organizationId" IN (SELECT id FROM organization WHERE slug = ANY($1))', [orgSlugs]);
    await db.query('DELETE FROM organization WHERE slug = ANY($1)', [orgSlugs]);
    await db.query('DELETE FROM "user" WHERE email LIKE $1', [`%${emailSuffix}`]);
  });
}

export async function verifyEmails(emailSuffix: string) {
  await withDb((db) => db.query('UPDATE "user" SET "emailVerified" = true WHERE email LIKE $1', [`%${emailSuffix}`]));
}
