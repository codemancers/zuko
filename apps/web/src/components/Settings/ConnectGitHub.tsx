'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Button, Subheading, Text, Badge } from '@zuko/ui-kit';
import { authClient } from '@/lib/auth-client';
import { SettingsCardSkeleton } from './SettingsCardSkeleton';

export default function ConnectGitHub() {
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkGitHubConnection();
  }, []);

  const checkGitHubConnection = async () => {
    try {
      const result = await authClient.listAccounts();

      // Better Auth returns { data: [...], error: null }
      const accounts = result?.data || [];

      const hasGitHub = accounts.some(
        (account: any) => account.providerId === 'github',
      );
      setIsConnected(hasGitHub);
    } catch (error) {
      console.error('Failed to check GitHub connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await authClient.linkSocial({
        provider: 'github',
        callbackURL: `${window.location.origin}/settings`,
      });
    } catch (error) {
      console.error('Connection error:', error);
      setConnecting(false);
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
                GitHub
              </Subheading>
              {isConnected && (
                <Badge color="lime" className="text-xs">
                  Connected
                </Badge>
              )}
            </div>

            {isConnected ? (
              <div className="space-y-1">
                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                  Your GitHub account is connected for authentication
                </Text>
              </div>
            ) : (
              <div className="space-y-1">
                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                  Connect GitHub for authentication and profile access
                </Text>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isConnected && (
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? 'Connecting...' : 'Connect'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
