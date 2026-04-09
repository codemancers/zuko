const EMPTY_VALUE = '—';

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

export function formatStage(stage: string): string {
  return stage
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
