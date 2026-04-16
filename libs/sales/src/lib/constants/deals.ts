export const DEAL_STAGES = [
  { label: 'Negotiation', value: 'negotiation' },
  { label: 'Proposal', value: 'proposal' },
  { label: 'Qualification', value: 'qualification' },
  { label: 'Prospecting', value: 'prospecting' },
  { label: 'Closed Won', value: 'closed_won' },
  { label: 'Closed Lost', value: 'closed_lost' },
] as const;

export const DEAL_STAGE_VALUES: string[] = DEAL_STAGES.map((s) => s.value as string);

export const DEAL_PRIORITIES = [
  { value: 0, label: 'P0 - Critical' },
  { value: 1, label: 'P1 - High' },
  { value: 2, label: 'P2 - Medium' },
  { value: 3, label: 'P3 - Low' },
  { value: 4, label: 'P4 - Backlog' },
] as const;
