'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge, Button, Heading, Text } from '@zuko/ui-kit';
import { BackLink, LoadingState } from '@/components/shared';
import { getProspect, getProspectEvents } from '@/server/query-options';
import {
  prospectsApi,
  type CampaignDisposition,
  type CampaignMembership,
  type ContactChannel,
  type ConsentState,
} from '@/lib/api/prospects';
import {
  CONSENT_COLORS,
  CONSENT_LABELS,
  DISPOSITION_COLORS,
  DISPOSITION_LABELS,
  ENGAGEMENT_COLORS,
  ENGAGEMENT_LABELS,
  EVENT_LABELS,
  MEMBERSHIP_STATE_COLORS,
  MEMBERSHIP_STATE_LABELS,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
  SIGNAL_ONLY_EVENTS,
  humanize,
  isOpenMembership,
} from './lifecycle-display';

const DISPOSITIONS: CampaignDisposition[] = [
  'interested',
  'nurture',
  'disqualified',
  'opted_out',
];

const CHANNELS: { channel: ContactChannel; label: string }[] = [
  { channel: 'email', label: 'Email' },
  { channel: 'linkedin', label: 'LinkedIn' },
  { channel: 'phone', label: 'Phone' },
];

interface ProspectDetailProps {
  prospectId: number;
}

export default function ProspectDetail({ prospectId }: ProspectDetailProps) {
  const queryClient = useQueryClient();

  const { data: prospect, isLoading } = useQuery(getProspect(prospectId));
  const { data: events = [] } = useQuery(getProspectEvents(prospectId));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['prospect', prospectId] });
    queryClient.invalidateQueries({ queryKey: ['prospects'] });
  };

  /** Service refusals carry the lifecycle rule that was broken — show it. */
  const failWith = (fallback: string) => (error: unknown) =>
    toast.error(error instanceof Error ? error.message : fallback);

  const promoteMutation = useMutation({
    mutationFn: () => prospectsApi.promote(prospectId),
    onSuccess: () => {
      refresh();
      toast.success('Promoted to lead');
    },
    onError: failWith('Could not promote this prospect'),
  });

  const suppressMutation = useMutation({
    mutationFn: () => prospectsApi.suppress(prospectId),
    onSuccess: () => {
      refresh();
      toast.success('Prospect suppressed — outbound stopped');
    },
    onError: failWith('Could not suppress this prospect'),
  });

  const consentMutation = useMutation({
    mutationFn: ({
      channel,
      consent,
    }: {
      channel: ContactChannel;
      consent: ConsentState;
    }) => prospectsApi.setConsent(prospectId, channel, consent),
    onSuccess: () => {
      refresh();
      toast.success('Consent updated');
    },
    onError: failWith('Could not update consent'),
  });

  const dispositionMutation = useMutation({
    mutationFn: ({
      membershipId,
      disposition,
    }: {
      membershipId: number;
      disposition: CampaignDisposition;
    }) => prospectsApi.setDisposition(membershipId, disposition),
    onSuccess: () => {
      refresh();
      toast.success('Membership concluded');
    },
    onError: failWith('Could not set the disposition'),
  });

  if (isLoading) return <LoadingState message="Loading prospect…" />;
  if (!prospect)
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Prospect not found.
      </p>
    );

  const openMemberships = prospect.memberships.filter((m) =>
    isOpenMembership(m.state),
  );

  return (
    <div className="flex min-h-0 flex-col">
      <BackLink href="/prospects">Prospects</BackLink>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Heading>{prospect.name}</Heading>
            <Badge color={PROSPECT_STATUS_COLORS[prospect.status] ?? 'zinc'}>
              {PROSPECT_STATUS_LABELS[prospect.status] ??
                humanize(prospect.status)}
            </Badge>
          </div>
          {(prospect.title || prospect.companyName) && (
            <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {prospect.title}
              {prospect.title && prospect.companyName ? ' · ' : ''}
              {prospect.companyName}
            </Text>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {prospect.status === 'engaged' && (
            <Button
              color="dark"
              disabled={promoteMutation.isPending}
              onClick={() => promoteMutation.mutate()}
            >
              {promoteMutation.isPending ? 'Promoting…' : 'Promote to Lead'}
            </Button>
          )}
          {prospect.status !== 'suppressed' && (
            <Button
              outline
              disabled={suppressMutation.isPending}
              onClick={() => suppressMutation.mutate()}
            >
              Suppress
            </Button>
          )}
        </div>
      </div>

      {prospect.leadId && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
          Promoted to{' '}
          <Link
            href={`/leads/${prospect.leadId}`}
            className="font-medium underline"
          >
            lead #{prospect.leadId}
          </Link>
          . Outbound is paused for this person.
        </div>
      )}

      {prospect.contactId && (
        <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
          Linked to existing contact{' '}
          <Link
            href={`/contacts/${prospect.contactId}`}
            className="font-medium underline"
          >
            {prospect.contact?.name ?? `#${prospect.contactId}`}
          </Link>
          .
        </div>
      )}

      {/* Contact details and consent */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Channels
        </h2>
        <div className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
          {CHANNELS.map(({ channel, label }) => {
            const value =
              channel === 'email'
                ? prospect.email
                : channel === 'linkedin'
                  ? prospect.linkedinUrl
                  : prospect.phone;
            const consent =
              channel === 'email'
                ? prospect.emailConsent
                : channel === 'linkedin'
                  ? prospect.linkedinConsent
                  : prospect.phoneConsent;

            return (
              <div
                key={channel}
                className="flex items-center justify-between gap-4 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {label}
                  </p>
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {value ?? '—'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge color={CONSENT_COLORS[consent] ?? 'zinc'}>
                    {CONSENT_LABELS[consent] ?? consent}
                  </Badge>
                  {value && consent !== 'revoked' && (
                    <Button
                      plain
                      disabled={consentMutation.isPending}
                      onClick={() =>
                        consentMutation.mutate({ channel, consent: 'revoked' })
                      }
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Campaign history */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Campaign history
        </h2>
        {prospect.memberships.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Never enrolled in a campaign.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {prospect.memberships.map((membership) => (
              <MembershipCard
                key={membership.id}
                membership={membership}
                busy={dispositionMutation.isPending}
                onConclude={(disposition) =>
                  dispositionMutation.mutate({
                    membershipId: membership.id,
                    disposition,
                  })
                }
              />
            ))}
          </div>
        )}
        {openMemberships.length > 1 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
            This prospect is running in {openMemberships.length} campaigns at
            once.
          </p>
        )}
      </section>

      {/* Event timeline */}
      <section className="mt-6 mb-8">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Activity
        </h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            No campaign activity yet.
          </p>
        ) : (
          <ol className="mt-2 space-y-1">
            {events.map((event) => {
              const muted = SIGNAL_ONLY_EVENTS.has(event.eventType);
              return (
                <li
                  key={event.id}
                  className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2 text-sm last:border-0 dark:border-zinc-800"
                >
                  <span
                    className={
                      muted
                        ? 'text-zinc-500 dark:text-zinc-400'
                        : 'font-medium text-zinc-900 dark:text-white'
                    }
                  >
                    {EVENT_LABELS[event.eventType] ?? humanize(event.eventType)}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {new Date(event.occurredAt).toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function MembershipCard({
  membership,
  busy,
  onConclude,
}: {
  membership: CampaignMembership;
  busy: boolean;
  onConclude: (disposition: CampaignDisposition) => void;
}) {
  const open = isOpenMembership(membership.state);

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-zinc-900 dark:text-white">
          {membership.campaign?.name ?? `Campaign ${membership.campaignId}`}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge color={MEMBERSHIP_STATE_COLORS[membership.state] ?? 'zinc'}>
            {MEMBERSHIP_STATE_LABELS[membership.state] ??
              humanize(membership.state)}
          </Badge>
          <Badge color={ENGAGEMENT_COLORS[membership.engagement] ?? 'zinc'}>
            {ENGAGEMENT_LABELS[membership.engagement] ??
              humanize(membership.engagement)}
          </Badge>
          {membership.disposition && (
            <Badge color={DISPOSITION_COLORS[membership.disposition] ?? 'zinc'}>
              {DISPOSITION_LABELS[membership.disposition] ??
                humanize(membership.disposition)}
            </Badge>
          )}
        </div>
      </div>

      {open && !membership.disposition && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Conclude as:
          </span>
          {DISPOSITIONS.map((disposition) => (
            <Button
              key={disposition}
              plain
              disabled={busy}
              onClick={() => onConclude(disposition)}
            >
              {DISPOSITION_LABELS[disposition]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
