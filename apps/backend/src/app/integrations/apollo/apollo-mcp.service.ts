import { Injectable } from '@nestjs/common';
import { ApolloIntegrationService } from './apollo-integration.service';

const APOLLO_MCP_ENDPOINT = 'https://mcp.apollo.io/mcp';

@Injectable()
export class ApolloMcpService {
  constructor(
    private readonly apolloIntegrationService: ApolloIntegrationService,
  ) {}

  async callTool<T = unknown>(
    organizationId: number,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    // Nango auto-refreshes the token on getConnection
    const accessToken =
      await this.apolloIntegrationService.getAccessToken(organizationId);

    const response = await fetch(APOLLO_MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      }),
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new Error(
        `Apollo MCP HTTP ${response.status} for tool ${toolName}: ${raw.slice(0, 200)}`,
      );
    }

    const jsonLine = raw
      .split('\n')
      .find((line) => line.startsWith('data:'))
      ?.replace('data:', '')
      .trim();

    if (!jsonLine) {
      throw new Error(
        `No data in MCP response for tool: ${toolName}. Raw: ${raw.slice(0, 200)}`,
      );
    }

    const envelope = JSON.parse(jsonLine) as {
      jsonrpc: string;
      id: number;
      result?: {
        content: Array<{ type: string; text: string }>;
        isError: boolean;
      };
      error?: { code: number; message: string };
    };

    if (envelope.error) {
      throw new Error(`MCP error (${toolName}): ${envelope.error.message}`);
    }

    const result = envelope.result!;

    if (result.isError) {
      throw new Error(
        `Apollo tool error (${toolName}): ${result.content[0]?.text}`,
      );
    }

    return JSON.parse(result.content[0].text) as T;
  }

  getAccessToken(organizationId: number) {
    return this.apolloIntegrationService.getAccessToken(organizationId);
  }

  async listTools(organizationId: number): Promise<unknown> {
    const accessToken =
      await this.apolloIntegrationService.getAccessToken(organizationId);

    const response = await fetch(APOLLO_MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list',
        params: {},
      }),
    });

    const raw = await response.text();
    const jsonLine = raw
      .split('\n')
      .find((line) => line.startsWith('data:'))
      ?.replace('data:', '')
      .trim();

    return jsonLine ? JSON.parse(jsonLine) : raw;
  }
}
