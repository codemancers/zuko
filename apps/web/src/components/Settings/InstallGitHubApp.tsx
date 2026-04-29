'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Button, Subheading, Text, Badge } from '@zuko/ui-kit';
import {
  getGitHubInstallationUrl,
  getGitHubInstallationStatus,
} from '@/server/actions/github';
import type { GitHubInstallationStatus } from '@/lib/api/github';
import { SettingsCardSkeleton } from './SettingsCardSkeleton';

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
    return <SettingsCardSkeleton />;
  }

  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 ring-1 ring-gray-200 dark:from-gray-900/20 dark:to-gray-800/20 dark:ring-gray-800">
            <Image
              src="/icons/github.svg"
              alt="GitHub"
              width={24}
              height={24}
            />
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
