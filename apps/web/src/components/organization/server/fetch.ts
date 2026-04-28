'use server';

import { cookies } from 'next/headers';
import {
  getGitHubInstallationStatus,
  getGitHubInstallationUrl,
} from '@/server/actions/github';

export type { GitHubInstallationStatus } from '@/lib/api/github';

export type LinkedAccount = {
  providerId: string;
  createdAt?: string | Date;
};

export { getGitHubInstallationStatus, getGitHubInstallationUrl };

function getAuthBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth`
    : 'http://localhost:3001/auth';
}

export async function fetchLinkedAccounts(): Promise<LinkedAccount[]> {
  try {
    const cookieStore = await cookies();
    const res = await fetch(`${getAuthBaseUrl()}/list-accounts`, {
      headers: { Cookie: cookieStore.toString() },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

