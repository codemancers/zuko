export type ConnectionStatus = {
  connectionId: string;
  status: 'connected' | 'disconnected';
  scope: 'individual' | 'org-wide';
  connectedBy: { name: string; isCurrentUser: boolean } | null;
  connectedAt: string | null;
};

export const INDIVIDUAL_CONNECTIONS: ReadonlyArray<{
  connectionId: string;
  providerId: string;
}> = [
  { connectionId: 'claude-code', providerId: 'claude' },
  { connectionId: 'codex', providerId: 'codex' },
];

export const ORG_NATIVE_CONNECTIONS: ReadonlyArray<{
  connectionId: string;
  provider: string;
}> = [];
