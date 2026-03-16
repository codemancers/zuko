export type UserContext = {
  userId?: string;
  provider?: string;
  projectId?: string;
  meetingId?: string;
  orgId?: string;
};

export type Config = {
  context?: { userContext?: UserContext };
  configurable?: { userContext?: UserContext };
};

export function getUserContextFromConfig(
  config?: Config
): UserContext | undefined {
  return config?.context?.userContext || config?.configurable?.userContext;
}