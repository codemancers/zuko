'use server';

import { githubApi } from '@/lib/api/github';

export async function getGitHubInstallationUrl() {
  try {
    return await githubApi.getInstallationUrl();
  } catch (error) {
    console.warn('Failed to get GitHub installation URL:', error);
    return { url: null };
  }
}

export async function getGitHubInstallationStatus() {
  try {
    return await githubApi.getInstallationStatus();
  } catch (error) {
    console.warn('Failed to get GitHub installation status:', error);
    return { installed: false };
  }
}
