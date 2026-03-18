import * as dotenv from "dotenv";
import * as path from "path";

// Load env vars before importing anything that reads them
dotenv.config({ path: path.join(__dirname, "../../../../.env.test.local") });
dotenv.config({ path: path.join(__dirname, "../../../../.env.test") });
dotenv.config({ path: path.join(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.join(__dirname, "../../../../.env") });

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { testUtils } from "better-auth/plugins";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

export type AuthUser = { id: number; email: string; name: string };

let _ctx: Awaited<ReturnType<typeof createContext>> | null = null;

async function createContext() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");

  const pool = new Pool({ connectionString });

  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool as any),
  });

  // Create a minimal auth instance that shares the same secret and generateId
  // config as the running backend, so session cookies are accepted by it.
  const auth = betterAuth({
    baseURL: process.env.BACKEND_URL || "http://localhost:3001",
    secret,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    advanced: {
      database: { generateId: "serial" },
      useSecureCookies: false,
      defaultCookieAttributes: { sameSite: "lax", secure: false },
    },
    plugins: [testUtils()],
  });

  return auth.$context;
}

/**
 * Returns the better-auth test context (singleton per Playwright worker).
 * Provides `ctx.test.createUser()`, `ctx.test.saveUser()`, `ctx.test.login()`, etc.
 */
export async function getAuthContext() {
  if (!_ctx) {
    _ctx = await createContext();
  }
  return _ctx;
}

/**
 * Create a fresh test user and return the user + Playwright-compatible cookies.
 * Cookies are already signed with the same secret as the backend.
 */
export async function createUserWithSession(
  overrides: Partial<AuthUser> = {},
): Promise<{
  user: AuthUser;
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
    expires?: number;
  }>;
  cleanup: () => Promise<void>;
}> {
  const ctx = await getAuthContext();

  const email = overrides.email ?? `e2e-${Date.now()}@example.com`;
  const name = overrides.name ?? "E2E Test User";

  const userObj = ctx.test.createUser({ email, name });
  const savedUser = await ctx.test.saveUser(userObj);

  const { cookies: rawCookies } = await ctx.test.login({
    userId: savedUser.id,
  });

  const cookies = rawCookies.map((c: any) => ({
    ...c,
    domain: "localhost",
    expires: c.expires ?? -1,
  }));

  const user: AuthUser = {
    id: parseInt(savedUser.id, 10),
    email: savedUser.email,
    name: savedUser.name,
  };

  const cleanup = async () => {
    await ctx.test.deleteUser(savedUser.id).catch(() => {
      // Ignore cleanup errors — DB may already be clean
    });
  };

  return { user, cookies, cleanup };
}
