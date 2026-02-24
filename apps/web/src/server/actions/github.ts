'use server';

import { githubApi } from '@/lib/api/github';

export async function getGitHubInstallationUrl() {
  return await githubApi.getInstallationUrl();
}

export async function getGitHubInstallationStatus() {
  return await githubApi.getInstallationStatus();
}
