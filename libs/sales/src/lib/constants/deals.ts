export const DEAL_STAGES = [
  { label: 'Negotiation', value: 'negotiation' },
  { label: 'Proposal', value: 'proposal' },
  { label: 'Qualification', value: 'qualification' },
  { label: 'Prospecting', value: 'prospecting' },
  { label: 'Closed Won', value: 'closed_won' },
  { label: 'Closed Lost', value: 'closed_lost' },
] as const;

export const DEAL_STAGE_VALUES: string[] = DEAL_STAGES.map((s) => s.value as string);
