import { Injectable, Logger } from "@nestjs/common";
import { BaseMessageLike, ContextEntityReference } from "@zuko/agents";

@Injectable()
export class LangsmithService {
  private readonly logger = new Logger(LangsmithService.name);
  private readonly langsmithApiKey: string;
  private readonly langsmithServerUrl: string;
  constructor() {
    this.langsmithApiKey = process.env.LANGSMITH_API_KEY as string;
    this.langsmithServerUrl = process.env.LANGSMITH_SERVER_URL ?? "http://localhost:2024";
  }

  /**
   * Creates a thread in LangSmith so state exists for new chats.
   * Uses if_exists: "do_nothing" so existing threads are not errored.
   */
  async createThread(threadId: string): Promise<void> {
    const baseUrl = this.langsmithServerUrl.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/threads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.langsmithApiKey,
      },
      body: JSON.stringify({
        thread_id: threadId,
        if_exists: "do_nothing",
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(
        `Failed to create LangSmith thread ${threadId}: ${response.status} ${text}`,
      );
      throw new Error(`Failed to create thread: ${response.statusText}`);
    }
  }

  async getThreadState(threadId: string) {
    const response = await fetch(
      `${this.langsmithServerUrl}/threads/${threadId}/state`,
      {
        headers: {
          "x-api-key": this.langsmithApiKey,
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) {
      this.logger.error("Failed to fetch thread state", response.statusText);
      throw new Error(`Failed to fetch thread state: ${response.statusText}`);
    }
    return response.json();
  }

  async createRunStream(params: {
    threadId: string;
    messages: BaseMessageLike[];
    contextEntities: ContextEntityReference[];
    userId: number;
    organizationId: number | null;
  }) {
    const {
      threadId,
      messages,
      contextEntities,
      userId,
      organizationId,
    } = params;

    
    const assistantId = process.env.LANGSMITH_ASSISTANT_ID ?? "agent";
    const baseUrl = this.langsmithServerUrl.replace(/\/$/, "");
    const url = `${baseUrl}/threads/${threadId}/runs/stream`;

    const payload = {
      assistant_id: assistantId,
      input: {
        messages,
        contextEntities,
        userId,
        organizationId,
      },
      stream_mode: ["values", "messages"] as const,
      multitask_strategy: "enqueue" as const,
      if_not_exists: "create" as const,
      on_disconnect: "continue" as const,
    };
    
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.langsmithApiKey,
      },
      body: JSON.stringify(payload),
    }).catch((error) => {
      this.logger.error("Failed to connect to agent server", error as Error);
      throw error;
    });

    if (!upstream.ok || !upstream.body) {
      await upstream.text().catch(() => "");
      throw new Error("Agent server stream failed");
    }

    return upstream.body as unknown as ReadableStream;
  }
}
