import type { SubAgent } from 'deepagents';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { RunnableConfig } from '@langchain/core/runnables';
import { getContextFromConfig } from '../tools/context';

const fetchMeetingsByOrg = tool(
  async (_input: Record<string, never>, config?: RunnableConfig) => {
    try {
      const ctx = getContextFromConfig(config);
      const { organizationId, userId } = ctx;

      const BACKEND_URL = process.env.BACKEND_URL ?? '';
      const AGENT_TOKEN = process.env.AGENT_TOKEN ?? '';

      const res = await fetch(`${BACKEND_URL}/api/agents/meetings`, {
        method: 'GET',
        headers: {
          'x-user-id': userId ?? '',
          'x-agent-token': AGENT_TOKEN,
          'x-org-id': organizationId ?? '',
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}`, meetings: [] };
      }

      const meetings = await res.json();
      return {
        success: true,
        meetings,
        count: Array.isArray(meetings) ? meetings.length : 0,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch meetings',
        meetings: [],
      };
    }
  },
  {
    name: 'fetch_meetings',
    description:
      'Fetch all meetings for the current organization. Returns a list of meetings including name, description, platform, status, and scheduled time.',
    schema: z.object({}),
  },
);

const SYSTEM_PROMPT = `You are a Meetings specialist agent.

Your responsibilities:
- Fetch and summarize meetings for the current organization
- Answer questions about meeting details, participants, and outcomes
- Provide insights across multiple meetings

Guidelines:
- Always call fetch_meetings when the user asks about meetings
- Summarize key information clearly: name, platform, status, date/time
- If no meetings are found, clearly state that`;

export function initializeMeetingsSubAgent(): SubAgent {
  return {
    name: 'Meeting Bot Agent',
    description:
      'Handles all meeting-related operations: fetching meetings, summarizing meeting details, and providing meeting insights.',
    systemPrompt: SYSTEM_PROMPT,
    tools: [fetchMeetingsByOrg] as any[],
  };
}
