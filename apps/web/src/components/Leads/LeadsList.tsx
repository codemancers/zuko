'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Badge, Button, Sheet, SheetHeader, SheetTitle } from '@zuko/ui-kit';
import { PageHeader, SearchBar } from '@/components/shared';
import { leadsApi } from '@/lib/api/leads';
import type { Lead } from '@/lib/api/leads';
import LeadForm from './LeadForm';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

const STATUS_COLORS: Record<string, 'green' | 'blue' | 'zinc' | 'yellow'> = {
  replied: 'blue',
  interested: 'green',
  not_interested: 'zinc',
  converted: 'yellow',
};

const STATUS_LABELS: Record<string, string> = {
  replied: 'Replied',
  interested: 'Interested',
  not_interested: 'Not Interested',
  converted: 'Converted',
};

const STATUS_FILTERS = [
  'all',
  'replied',
  'interested',
  'not_interested',
  'converted',
];

const LeadsList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', search, statusFilter],
    queryFn: () =>
      leadsApi.list({
        search: search || undefined,
        status: statusFilter !== 'all' ? [statusFilter] : undefined,
        perPage: 100,
      }),
    placeholderData: (prev) => prev,
  });

  const { mutate: deleteLead, isPending: isDeleting } = useMutation({
    mutationFn: (id: number) => leadsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deleted');
      setLeadToDelete(null);
    },
    onError: () => toast.error('Failed to delete lead'),
  });

  const { mutate: convertLead } = useMutation({
    mutationFn: (id: number) =>
      leadsApi.convert(id) as Promise<{ deal?: { id?: number } }>,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead converted to deal');
      if (result?.deal?.id) router.push(`/deals/${result.deal.id}`);
    },
    onError: () => toast.error('Failed to convert lead'),
  });

  const openCreate = () => {
    setEditLead(null);
    setIsSheetOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditLead(lead);
    setIsSheetOpen(true);
  };

  const leads = data?.data ?? [];

  return (
    <>
      <div className="flex h-full flex-col">
        <PageHeader
          title="Leads"
          action={
            <Button color="dark" onClick={openCreate}>
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Lead
            </Button>
          }
        />

        <div className="px-4 py-3 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-700">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search leads..."
          />
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded text-sm capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-zinc-500">Loading...</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No leads found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    ICP Profile
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer"
                    onClick={() => openEdit(lead)}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {lead.name}
                      {lead.title && (
                        <div className="text-xs text-zinc-500">
                          {lead.title}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {lead.companyName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {lead.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {lead.icpProfile?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color="zinc" className="capitalize">
                        {lead.source}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={STATUS_COLORS[lead.status] ?? 'zinc'}>
                        {STATUS_LABELS[lead.status] ?? lead.status}
                      </Badge>
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-2">
                        {lead.status !== 'converted' && (
                          <Button
                            plain
                            className="text-xs"
                            onClick={() => convertLead(lead.id)}
                          >
                            → Deal
                          </Button>
                        )}
                        <Button
                          plain
                          className="text-xs text-red-500"
                          onClick={() => setLeadToDelete(lead.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Sheet open={isSheetOpen} onClose={() => setIsSheetOpen(false)}>
        <SheetHeader>
          <SheetTitle>{editLead ? 'Edit Lead' : 'New Lead'}</SheetTitle>
          <button onClick={() => setIsSheetOpen(false)}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </SheetHeader>
        <LeadForm
          lead={editLead ?? undefined}
          onSuccess={() => setIsSheetOpen(false)}
        />
      </Sheet>

      <ConfirmDialog
        open={leadToDelete !== null}
        onClose={() => setLeadToDelete(null)}
        onConfirm={() => leadToDelete && deleteLead(leadToDelete)}
        title="Delete Lead"
        description="Are you sure you want to delete this lead? This action cannot be undone."
        confirmText="Delete"
        isLoading={isDeleting}
      />
    </>
  );
};

export default LeadsList;
