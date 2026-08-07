'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLead, getLeadSequenceActivity } from '@/server/query-options';
import { leadsApi } from '@/lib/api/leads';
import { BackLink, LoadingState } from '@/components/shared';
import { Badge, Button, Heading, Text } from '@zuko/ui-kit';
import {
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
} from '@heroicons/react/20/solid';
import Link from 'next/link';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const STATUS_COLORS: Record<string, 'green' | 'blue' | 'red' | 'zinc'> = {
  replied: 'blue',
  interested: 'green',
  not_interested: 'red',
  converted: 'zinc',
};

function SidebarField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </Text>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export default function LeadDetail({ leadId }: { leadId: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: lead, isLoading } = useQuery(getLead(leadId));
  const { data: sequenceActivity } = useQuery({
    ...getLeadSequenceActivity(leadId),
    enabled: !!(lead?.apolloPersonId && lead?.campaign?.providerSequenceId),
  });

  const convertMutation = useMutation({
    mutationFn: () => leadsApi.convert(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead converted to deal');
    },
    onError: () => toast.error('Failed to convert lead'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => leadsApi.delete(leadId),
    onSuccess: () => {
      toast.success('Lead deleted');
      router.push('/leads');
    },
    onError: () => toast.error('Failed to delete lead'),
  });

  if (isLoading) return <LoadingState message="Loading lead…" />;
  if (!lead)
    return (
      <p className="py-8 text-center text-sm text-zinc-500">Lead not found.</p>
    );

  return (
    <div className="flex min-h-0 flex-col">
      <BackLink href="/leads">Leads</BackLink>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <Heading>{lead.name}</Heading>
          {lead.title && (
            <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {lead.title}
              {lead.companyName ? ` · ${lead.companyName}` : ''}
            </Text>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {lead.status !== 'converted' && (
            <Button
              outline
              disabled={convertMutation.isPending}
              onClick={() => convertMutation.mutate()}
            >
              {convertMutation.isPending ? 'Converting…' : '→ Convert to Deal'}
            </Button>
          )}
          <Button
            color="red"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-8">
        {/* Contact info */}
        <div className="min-w-0 flex-1 space-y-4">
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-2 text-sm text-zinc-700 hover:underline dark:text-zinc-300"
            >
              <EnvelopeIcon className="size-4 shrink-0 text-zinc-400" />
              {lead.email}
            </a>
          )}
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="flex items-center gap-2 text-sm text-zinc-700 hover:underline dark:text-zinc-300"
            >
              <PhoneIcon className="size-4 shrink-0 text-zinc-400" />
              {lead.phone}
            </a>
          )}
          {lead.companyName && (
            <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <BuildingOfficeIcon className="size-4 shrink-0 text-zinc-400" />
              {lead.companyName}
            </div>
          )}
          {lead.title && (
            <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <BriefcaseIcon className="size-4 shrink-0 text-zinc-400" />
              {lead.title}
            </div>
          )}
          {lead.linkedinUrl && (
            <a
              href={lead.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-blue-500 hover:underline"
            >
              LinkedIn →
            </a>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-64 shrink-0 space-y-5 border-l border-zinc-200 pl-8 dark:border-zinc-700/50">
          <SidebarField label="Status">
            <Badge color={STATUS_COLORS[lead.status] ?? 'zinc'}>
              {lead.status.replace(/_/g, ' ')}
            </Badge>
          </SidebarField>

          <SidebarField label="Source">
            <Text className="text-sm capitalize text-zinc-700 dark:text-zinc-300">
              {lead.source}
            </Text>
          </SidebarField>

          {lead.icpProfile && (
            <SidebarField label="ICP Profile">
              <Link
                href={`/icps/${lead.icpProfile.id}`}
                className="text-sm text-zinc-700 hover:underline dark:text-zinc-300"
              >
                {lead.icpProfile.name}
              </Link>
            </SidebarField>
          )}

          {lead.campaign && (
            <SidebarField label="Campaign">
              <Link
                href={`/campaigns/${lead.campaign.id}`}
                className="text-sm text-zinc-700 hover:underline dark:text-zinc-300"
              >
                {lead.campaign.name}
              </Link>
            </SidebarField>
          )}

          {lead.contact && (
            <SidebarField label="Contact">
              <Link
                href={`/contacts/${lead.contact.id}`}
                className="text-sm text-zinc-700 hover:underline dark:text-zinc-300"
              >
                {lead.contact.name}
              </Link>
            </SidebarField>
          )}

          {lead.deal && (
            <SidebarField label="Deal">
              <Link
                href={`/deals/${lead.deal.id}`}
                className="text-sm text-zinc-700 hover:underline dark:text-zinc-300"
              >
                {lead.deal.title}
              </Link>
            </SidebarField>
          )}

          <SidebarField label="Created">
            <Text className="text-sm text-zinc-700 dark:text-zinc-300">
              {dayjs(lead.createdAt).format('MMM D, YYYY')}
            </Text>
          </SidebarField>
        </div>
      </div>

      {sequenceActivity && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <Heading level={2} className="text-base font-semibold">
              Sequence Emails
              {sequenceActivity.sequenceName
                ? ` — ${sequenceActivity.sequenceName}`
                : ''}
            </Heading>
            {sequenceActivity.sequenceStatus && (
              <Badge color="blue" className="capitalize">
                {sequenceActivity.sequenceStatus.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>

          {sequenceActivity.messages.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No emails found for this contact in the sequence.
            </p>
          ) : (
            <div className="space-y-4">
              {sequenceActivity.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg border p-4 ${
                    msg.type === 'reply'
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20'
                      : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/40'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {msg.subject && (
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {msg.subject}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {msg.type === 'reply' ? '← Reply from' : '→ Sent to'}{' '}
                        {msg.type === 'reply' ? msg.fromEmail : msg.toEmail}
                      </p>
                    </div>
                    {msg.sentAt && (
                      <time className="shrink-0 text-xs text-zinc-400">
                        {dayjs(msg.sentAt).format('MMM D, YYYY h:mm A')}
                      </time>
                    )}
                  </div>
                  {msg.bodyText && (
                    <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                      {msg.bodyText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
