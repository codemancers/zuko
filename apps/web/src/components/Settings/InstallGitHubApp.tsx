'use client';

import { useState, useEffect } from 'react';
import { Button, Subheading, Text, Badge } from '@zuko/ui-kit';
import {
  getGitHubInstallationUrl,
  getGitHubInstallationStatus,
} from '@/server/actions/github';
import type { GitHubInstallationStatus } from '@/lib/api/github';

export default function InstallGitHubApp() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<GitHubInstallationStatus | null>(null);

  useEffect(() => {
    checkInstallationStatus();
  }, []);

  const checkInstallationStatus = async () => {
    try {
      const data = await getGitHubInstallationStatus();
      if (data) {
        setStatus(data);
      }
    } catch (error) {
      console.warn('Failed to check GitHub App installation status:', error);
      // Fallback to non-installed state instead of crashing
      setStatus({ installed: false });
    } finally {
      setLoading(false);
    }
  };

  const handleInstallApp = async () => {
    try {
      const data = await getGitHubInstallationUrl();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No installation URL returned');
      }
    } catch (error) {
      console.error('Failed to generate GitHub installation URL:', error);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-zinc-200 dark:bg-zinc-700"></div>
            <div className="space-y-2">
              <div className="h-5 w-24 rounded bg-zinc-200 dark:bg-zinc-700"></div>
              <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700"></div>
            </div>
          </div>
          <div className="h-8 w-20 rounded bg-zinc-200 dark:bg-zinc-700"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 ring-1 ring-gray-200 dark:from-gray-900/20 dark:to-gray-800/20 dark:ring-gray-800">
            <svg
              className="h-6 w-6 text-gray-900 dark:text-gray-100"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-3">
              <Subheading className="text-zinc-900 dark:text-zinc-100">
                GitHub App
              </Subheading>
              {status?.installed && (
                <Badge color="lime" className="text-xs">
                  Installed
                </Badge>
              )}
            </div>

            {status?.installed ? (
              <div className="space-y-1">
                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                  Installed on{' '}
                  <span className="font-medium">
                    {status.installation?.accountLogin}
                  </span>
                </Text>
                <Text className="text-xs text-zinc-500 dark:text-zinc-500">
                  The GitHub App is ready to manage tasks across your
                  repositories
                </Text>
              </div>
            ) : (
              <div className="space-y-1">
                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                  Install the GitHub App to enable task management
                </Text>
                <Text className="text-xs text-zinc-500 dark:text-zinc-500">
                  The app will request access to repositories where you want to
                  manage tasks
                </Text>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleInstallApp}>
            {status?.installed ? 'Re-install' : 'Install'}
          </Button>
        </div>
      </div>
    </div>
  );
}
