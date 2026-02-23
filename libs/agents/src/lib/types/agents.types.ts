export type AgentRequest = {
  source: 'chat';
  teamId?: string;
  userId?: string;
  channelId?: string;
  threadTs?: string;
  text?: string;
  eventId?: string;
  responseUrl?: string;
  metadata?: Record<string, unknown>;
};

export type AgentResponse = {
  text?: string;
  blocks?: unknown[];
  attachments?: unknown[];
  channelId?: string;
  threadTs?: string;
  ephemeral?: boolean;
};
