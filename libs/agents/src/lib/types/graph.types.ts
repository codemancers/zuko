export type GraphStreamMode = 'updates' | 'messages' | 'custom';

export type GraphStreamRequest = {
  input: unknown;
  config?: Record<string, unknown>;
  stream_mode?: GraphStreamMode | GraphStreamMode[];
};
