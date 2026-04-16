import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

export interface TestUser {
  id: number;
  email: string;
  name: string;
  sessionToken: string;
}

/**
 * Creates a test user and session directly in the database
 * This bypasses the OAuth flow for testing purposes
 */
export async function createTestUserWithSession(): Promise<TestUser> {
  const testEmail = `test-${Date.now()}@example.com`;
  const testName = "Test User";

  // Create user
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: testName,
      emailVerified: true,
    },
  });

  // Create session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      token: generateSessionToken(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    sessionToken: session.token,
  };
}

/**
 * Deletes a test user and all related data
 */
export async function deleteTestUser(userId: number): Promise<void> {
  await prisma.user.delete({
    where: { id: userId },
  });
}

/**
 * Deletes all test users (emails starting with test-)
 */
export async function cleanupTestUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: "test-",
      },
    },
  });
}

/**
 * Generates a random session token
 */
function generateSessionToken(): string {
  return `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Gets the auth cookie string for axios requests
 */
export function getAuthCookie(sessionToken: string): string {
  // Better Auth uses the cookie name format: better-auth.session_token
  return `better-auth.session_token=${sessionToken}`;
}

/**
 * Creates an authenticated axios instance for testing
 */
export async function createAuthenticatedClient() {
  const testUser = await createTestUserWithSession();
  const authCookie = getAuthCookie(testUser.sessionToken);

  const client = axios.create({
    headers: {
      Cookie: authCookie,
    },
  });

  return {
    client,
    testUser,
    cleanup: () => deleteTestUser(testUser.id),
  };
}
