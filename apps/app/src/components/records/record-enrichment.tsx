'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, LoaderCircle, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { permissionsQuery } from '@/lib/queries';

/** The standard objects Apollo can describe; the server refuses anything else. */
export const ENRICHABLE_OBJECTS = ['contact', 'prospect', 'lead', 'company'] as const;

/** A person is matched by email, or by name and company; a company by its domain, which its own record holds. */
const NEEDS_COMPANY = new Set(['contact', 'prospect', 'lead']);

/** What someone typed as the company: a website becomes a domain, anything else a name. */
export function companyHint(text: string): { domain?: string; organization_name?: string } {
  const value = text.trim();
  if (!value) return {};
  return /^[^\s@]+\.[^\s@]+$/.test(value) ? { domain: value } : { organization_name: value };
}

interface Stored {
  provider: string;
  subject: string;
  payload: unknown;
  fetched_at: string;
}
interface Outcome {
  matched: boolean;
  applied: string[];
  skipped: { field: string; reason: string }[];
}

const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const REASONS: Record<string, string> = {
  ALREADY_SET: 'already has a value',
  NO_SUCH_FIELD: 'no such field on this object',
  DUPLICATE_VALUE: 'another record has it',
};

/**
 * Looks the record up in Apollo and shows what came back. It costs Apollo credits, so it only runs when
 * pressed. Values the record already has are kept; the full response is shown below for reference.
 */
export function RecordEnrichment({
  object,
  recordId,
  onChanged,
}: {
  object: string;
  recordId: string;
  /** The record's fields changed; reload it. */
  onChanged: () => void;
}) {
  const client = useQueryClient();
  const permissions = useQuery(permissionsQuery);
  const base = `/api/v1/objects/${object}/records/${recordId}`;
  const key = ['record-enrichment', object, recordId];
  const stored = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api<{ results: Stored[] }>(`${base}/enrichment`, { signal }),
  });
  const [outcome, setOutcome] = useState<Outcome>();
  const [company, setCompany] = useState('');
  const run = useMutation({
    mutationFn: () => api<Outcome>(`${base}/enrich`, { method: 'POST', json: companyHint(company) }),
    onSuccess: (result) => {
      setOutcome(result);
      void client.invalidateQueries({ queryKey: key });
      if (result.applied.length > 0) onChanged();
    },
  });

  if (permissions.data?.can_enrich_records === false) return null;
  const apollo = stored.data?.results.find((row) => row.provider === 'apollo');

  return (
    <section aria-labelledby="enrichment-heading" className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="enrichment-heading" className="text-sm font-medium">
            Apollo
          </h3>
          <p className="text-xs text-muted-foreground">
            {apollo ? `Last looked up ${when.format(new Date(apollo.fetched_at))}` : 'Not looked up yet'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={run.isPending}
          onClick={() => {
            setOutcome(undefined);
            run.mutate();
          }}
        >
          {run.isPending ? (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Sparkles aria-hidden />
          )}
          {apollo ? 'Enrich again' : 'Enrich with Apollo'}
        </Button>
      </div>

      {NEEDS_COMPANY.has(object) && (
        <div className="space-y-1">
          <Input
            aria-label="Company website or name"
            value={company}
            placeholder="Company website or name (needed when there is no email)"
            onChange={(event) => setCompany(event.target.value)}
          />
        </div>
      )}
      {run.error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{run.error.message}</AlertDescription>
        </Alert>
      )}
      {outcome && !outcome.matched && (
        <output className="block text-sm text-muted-foreground">Apollo has no match for this record.</output>
      )}
      {outcome?.matched && (
        <output className="block space-y-1 text-sm">
          <p>{outcome.applied.length > 0 ? `Filled in: ${outcome.applied.join(', ')}.` : 'Nothing new to fill in.'}</p>
          {outcome.skipped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Left alone:{' '}
              {outcome.skipped.map((s) => `${s.field} (${REASONS[s.reason] ?? s.reason})`).join(', ')}.
            </p>
          )}
        </output>
      )}
      {apollo && (
        <details className="rounded-lg border bg-card text-sm">
          <summary className="cursor-pointer px-3 py-2 font-medium">Apollo data</summary>
          <pre className="max-h-80 overflow-auto border-t p-3 text-xs">{JSON.stringify(apollo.payload, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
