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
  headers?: Record<string, string>;
}

/** A signed-in user: remembers the session cookie and sends it with every call. */
export class User {
  cookie = '';
  id = '';

  constructor(
    readonly name: string,
    readonly email: string,
    readonly waitForOrganizationSetup = true,
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
    if (
      this.waitForOrganizationSetup &&
      method === 'POST' &&
      url === '/auth/organization/create' &&
      res.status === 200
    ) {
      await this.waitForSetup(res.data.id);
    }
    return { status: res.status, data: res.data };
  }

  /** Fixture creation waits for backend provisioning, never provisions schema itself. */
  async waitForSetup(organizationId: string, status = 'ready') {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const setup = await withDb(
        async (db) =>
          (
            await db.query(
              'SELECT status, error, "runId", attempt FROM organization_setup WHERE "organizationId"=$1',
              [organizationId],
            )
          ).rows[0],
      );
      if (setup?.status === status) return setup;
      if (setup?.status === 'failed' && status !== 'failed')
        throw new Error(`Setup failed: ${JSON.stringify(setup)}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Organization ${organizationId} never reached ${status}`);
  }

  /** An application/x-www-form-urlencoded POST, as the OAuth token endpoint expects. */
  async form(url: string, data: Record<string, string>): Promise<Reply> {
    const res = await axios.post(url, new URLSearchParams(data).toString(), {
      headers: {
        Origin: ORIGIN,
        'content-type': 'application/x-www-form-urlencoded',
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      validateStatus: () => true,
    });
    return { status: res.status, data: res.data };
  }

  /** A multipart upload of one file in the `file` field (or `field`), with any extra text fields. */
  async upload(
    url: string,
    filename: string,
    bytes: Uint8Array,
    type = 'application/octet-stream',
    field = 'file',
    extra: Record<string, string> = {},
  ): Promise<Reply> {
    const form = new FormData();
    for (const [name, value] of Object.entries(extra)) form.append(name, value);
    form.append(field, new Blob([bytes], { type }), filename);
    const res = await axios.post(url, form, {
      headers: { Origin: ORIGIN, ...(this.cookie ? { Cookie: this.cookie } : {}) },
      validateStatus: () => true,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return { status: res.status, data: res.data };
  }

  /** A GET that returns the raw bytes and the response headers. */
  async download(url: string): Promise<Reply & { bytes: Buffer }> {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { Origin: ORIGIN, ...(this.cookie ? { Cookie: this.cookie } : {}) },
      validateStatus: () => true,
      maxContentLength: Infinity,
    });
    const bytes = Buffer.from(res.data);
    let data: unknown = bytes;
    if (String(res.headers['content-type']).includes('json')) {
      try { data = JSON.parse(bytes.toString('utf8')); } catch { /* keep the bytes */ }
    }
    return { status: res.status, data, bytes, headers: res.headers as Record<string, string> };
  }

  get = (url: string) => this.call('GET', url);
  post = (url: string, data?: unknown) => this.call('POST', url, data);
  patch = (url: string, data?: unknown) => this.call('PATCH', url, data);
  put = (url: string, data?: unknown) => this.call('PUT', url, data);
  del = (url: string) => this.call('DELETE', url);

  async signUp() {
    const res = await this.post('/auth/sign-up/email', {
      name: this.name,
      email: this.email,
      password: PASSWORD,
    });
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
export async function cleanup(emailSuffix: string, orgSlugs: string[], oauthClientPrefix?: string) {
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
    await db.query(
      'DELETE FROM object_record WHERE "organizationId" IN (SELECT id FROM organization WHERE slug = ANY($1))',
      [orgSlugs],
    );
    await db.query('DELETE FROM organization WHERE slug = ANY($1)', [orgSlugs]);
    // OAuth clients registered by one run's MCP tests (their tokens and consents go with
    // them). Scoped to the run: spec files run in parallel, and another file's cleanup must
    // never delete clients that are still in use.
    if (oauthClientPrefix) {
      await db.query('DELETE FROM oauth_client WHERE name LIKE $1', [`${oauthClientPrefix}%`]);
    }
    await db.query('DELETE FROM "user" WHERE email LIKE $1', [`%${emailSuffix}`]);
  });
}

export async function verifyEmails(emailSuffix: string) {
  await withDb((db) =>
    db.query('UPDATE "user" SET "emailVerified" = true WHERE email LIKE $1', [`%${emailSuffix}`]),
  );
}
