'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserInvitations } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { Button, Heading, Text, Badge } from '@zuko/ui-kit';
import { toast } from 'sonner';
import { useState } from 'react';

export const UserInvitations = () => {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const { data: invitations = [], isLoading } = useQuery(getUserInvitations());

  const handleAccept = async (invitationId: string) => {
    setIsProcessing(invitationId);
    try {
      const { error } = await authClient.organization.acceptInvitation({
        invitationId,
      });

      if (error) {
        toast.error(error.message || 'Failed to accept invitation');
        return;
      }

      toast.success('Invitation accepted');
      // Invalidate queries to refresh organization list and user status
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'invitations'] });

      // Optionally reload to ensure all organization-specific state is fresh
      window.location.reload();
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (invitationId: string) => {
    setIsProcessing(invitationId);
    try {
      const { error } = await authClient.organization.rejectInvitation({
        invitationId,
      });

      if (error) {
        toast.error(error.message || 'Failed to reject invitation');
        return;
      }

      toast.success('Invitation rejected');
      queryClient.invalidateQueries({ queryKey: ['user', 'invitations'] });
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsProcessing(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-4 text-sm text-zinc-500">Loading invitations...</div>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-900/30 dark:bg-blue-900/10">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Heading level={3}>Incoming Invitations</Heading>
          <Badge color="blue">{invitations.length}</Badge>
        </div>
        <Text className="mt-1 text-zinc-600 dark:text-zinc-400">
          You have been invited to join the following organizations.
        </Text>
      </div>

      <div className="space-y-4">
        {invitations.map((invitation, index) => (
          <div
            key={invitation.id}
            className="flex items-center justify-between rounded-xl border border-zinc-200/50 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-0.5">
              <div className="text-base font-semibold text-zinc-950 dark:text-white">
                {invitation.organizationName}
              </div>
              <div className="text-sm text-zinc-500">
                Invited as <span className="capitalize">{invitation.role}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                plain
                onClick={() => handleReject(invitation.id)}
                disabled={!!isProcessing}
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Decline
              </Button>
              <Button
                onClick={() => handleAccept(invitation.id)}
                disabled={!!isProcessing}
                color="blue"
              >
                {isProcessing === invitation.id ? 'Accepting...' : 'Accept'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
