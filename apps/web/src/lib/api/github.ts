/**
 * GitHub API client
 * Type-safe methods for GitHub app integration
 */

import { apiClient } from "../api-client";

export interface GitHubInstallation {
  accountLogin: string;
  installedAt: Date;
}

export interface GitHubInstallationStatus {
  installed: boolean;
  installation?: GitHubInstallation;
  message?: string;
}

export interface GitHubInstallationUrl {
  url: string;
}

export const githubApi = {
  /**
   * Get GitHub App installation status for current user
   */
  async getInstallationStatus(): Promise<GitHubInstallationStatus> {
    return apiClient.get("/github/installation/status");
  },

  /**
   * Get GitHub App installation URL
   */
  async getInstallationUrl(): Promise<GitHubInstallationUrl> {
    return apiClient.get("/github/installation/url");
  },
};
