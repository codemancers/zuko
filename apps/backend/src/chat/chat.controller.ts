import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import {
  OrchestratorService,
  BaseMessageLike,
  type ChatCompletionRequest,
  ContextEntityReference,
  MessageMetadata,
} from "@zuko/agents";
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import type { UIMessage } from "ai";
import type { RequestWithUser } from "@zuko/core";
import { ChatsService } from "../chats/chats.service";
import { PrismaService } from "../prisma/prisma.service";
import { getActiveOrganizationId } from "../common/auth/get-organization-id";

const LOCAL_MODEL_ID = process.env.AGENTS_LLM_MODEL ?? "gpt-4o";

@Controller("v1")
export class ChatController {
  constructor(
    private readonly agentsService: OrchestratorService,
    private readonly chatsService: ChatsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("chat/completions")
  async openwebuiChat(
    @Body() body: ChatCompletionRequest,
    @Headers("accept") accept?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    const incomingMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages: BaseMessageLike[] = [...incomingMessages];
    if (messages.length === 0) {
      messages.push({ role: "user", content: "What is 1+1." });
    }

    const threadId = body.thread_id ?? randomUUID();

    if (
      accept?.includes("text/event-stream") ||
      accept?.includes("text/plain")
    ) {
      response?.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      response?.setHeader("Cache-Control", "no-cache");
      response?.setHeader("Connection", "keep-alive");
      response?.setHeader("X-Thread-Id", threadId);

      for await (const chunk of this.agentsService.streamReply(
        messages,
        threadId,
      )) {
        response?.write(`data: ${chunk}\n\n`);
      }
      response?.end();
      return;
    }

    response?.setHeader("X-Thread-Id", threadId);
    const reply = await this.agentsService.generateReply(messages, threadId);

    return {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: body.model ?? LOCAL_MODEL_ID,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: reply },
          finish_reason: "stop",
        },
      ],
    };
  }

  @Post("chat")
  @UseGuards(AuthGuard)
  async chat(
    @Body()
    body: {
      messages: UIMessage[];
      chatId: string | number;
      contextEntities?: ContextEntityReference[];
    },
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    console.log(
      "[ChatController] Received body:",
      JSON.stringify(body, null, 2),
    );

    const { messages, chatId: rawChatId } = body;
    const lastMessage = messages[messages.length - 1];
    // Prefer last message metadata; fallback to top-level body (AI SDK useChat may send body.contextEntities)
    const contextEntities =
      (lastMessage?.metadata as MessageMetadata)?.contextEntities ??
      body.contextEntities ??
      [];

    const chatId =
      typeof rawChatId === "string" ? parseInt(rawChatId, 10) : rawChatId;
    console.log("[ChatController] Extracted chatId:", chatId);
    console.log("[ChatController] Extracted messages count:", messages?.length);
    console.log(
      "[ChatController] Context entities from message metadata:",
      JSON.stringify(contextEntities, null, 2),
    );
    
    const userId = parseInt(req.user.id, 10);
    const organizationId = await getActiveOrganizationId(req, this.prisma);

    // Verify user is a participant in this chat
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException("Not a participant in this chat");
    }

    // Get the chat to extract threadId
    const chat = await this.chatsService.findOne(chatId);
    const threadId = chat.threadId;

    // Auto-generate title from first message if chat has no title
    if (!chat.title && messages.length === 1) {
      const firstMessage = messages[0];
      // Extract text from parts array (AI SDK v6 format)
      const text =
        firstMessage.parts
          ?.filter((part: any) => part.type === "text")
          .map((part: any) => part.text)
          .join("") || ((firstMessage as any).content as string);

      if (text?.trim()) {
        console.log(
          "[ChatController] Auto-generating title for chat:",
          chatId,
          "from text:",
          text.substring(0, 50),
        );
        // Don't await - let it run in background
        this.chatsService
          .autoGenerateTitle(chatId, text.trim())
          .catch((err) => {
            console.error(
              "[ChatController] Failed to auto-generate title:",
              err,
            );
          });
      }
    }

    // Convert AI SDK UIMessages to LangChain base messages
    // Filter out messages with unsupported roles (e.g., 'tool') that cause conversion errors
    const supportedRoles = new Set(["user", "assistant", "system"]);
    const filteredMessages = messages.filter((msg) =>
      supportedRoles.has(msg.role),
    );

    if (filteredMessages.length !== messages.length) {
      console.log(
        `[ChatController] Filtered out ${
          messages.length - filteredMessages.length
        } messages with unsupported roles`,
      );
    }

    const langchainMessages = await toBaseMessages(filteredMessages);

    // Get the agent and stream
    const agent = await (this.agentsService as any).ensureAgent();
    const config = {
      streamMode: ["values", "messages"] as const,
      configurable: {
        thread_id: threadId,
        contextEntities,
        organizationId,
      },
    };

    // Stream from the LangGraph agent
    // Pass contextEntities, userId, organizationId in state - persisted by LangGraph checkpointer so tools can scope to org
    const stream = await agent.stream(
      {
        messages: langchainMessages,
        contextEntities,
        userId,
        organizationId,
      },
      config,
    );

    // Set SSE headers
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Thread-Id", threadId);
    response.setHeader("X-Chat-Id", chatId);

    // Convert LangGraph stream to UI message stream format
    const uiStream = toUIMessageStream(stream);

    // Stream the data
    for await (const chunk of uiStream) {
      response.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    response.end();
  }
}
