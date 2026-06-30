import dayjs from 'dayjs';

const EMPTY_VALUE = '—';
export const TABLE_DATE_FORMAT = 'DD MMM YYYY';

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return EMPTY_VALUE;
  const d = dayjs(value);
  return d.isValid() ? d.format(TABLE_DATE_FORMAT) : EMPTY_VALUE;
}

export function formatCurrency(value?: number, currency?: string): string {
  if (value === undefined || value === null) return EMPTY_VALUE;
  const curr = currency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getStageColor(
  stage: string,
): 'zinc' | 'blue' | 'yellow' | 'green' | 'red' {
  const stageColors: Record<
    string,
    'zinc' | 'blue' | 'yellow' | 'green' | 'red'
  > = {
    prospecting: 'zinc',
    qualification: 'blue',
    proposal: 'yellow',
    negotiation: 'yellow',
    closed_won: 'green',
    closed_lost: 'red',
  };
  return stageColors[stage] || 'zinc';
}

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export function formatStage(stage: string): string {
  return (
    STAGE_LABELS[stage] ??
    stage
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}
