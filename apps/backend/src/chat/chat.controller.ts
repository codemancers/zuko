import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { Readable } from "node:stream";
import type { ContextEntityReference } from "../types/chat";
import { toUIMessageStream } from "@ai-sdk/langchain";
import type { UIMessage } from "ai";
import type { RequestWithUser } from "@zuko/core";
import type { ChatsService } from "../chats/chats.service";
import type { LangsmithService } from "../langsmith/langsmith.service";
import { transformSSEToLangChainStreamFromNode } from "../langsmith/langsmith-stream.util";


@Controller("v1")
export class ChatController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly langsmithService: LangsmithService,
  ) {}

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
    const { messages, chatId: rawChatId } = body;
    const chatId =
      typeof rawChatId === "string" ? parseInt(rawChatId, 10) : rawChatId;
    const userId = parseInt(req.user.id, 10);
    const organizationId = await this.chatsService.getOrganizationId(req);
    const preparedRun = await this.chatsService.prepareChatRun({
      chatId,
      userId,
      messages,
      contextEntities: body.contextEntities,
    });

    // Set SSE headers for the client
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Thread-Id", preparedRun.threadId);
    response.setHeader("X-Chat-Id", chatId);

    const upstreamBody = await this.langsmithService.createRunStream({
      threadId: preparedRun.threadId,
      messages: preparedRun.langchainMessages,
      contextEntities: preparedRun.contextEntities,
      userId,
      organizationId,
      sandboxUrl: preparedRun.sandboxUrl,
    });

    const nodeStream = Readable.fromWeb(
      upstreamBody as unknown as ReadableStream,
    );
    const langchainStream =
      transformSSEToLangChainStreamFromNode(nodeStream);
    const uiStream = toUIMessageStream(langchainStream as any);

    try {
      for await (const chunk of uiStream) {
        response.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (err) {
      // swallow streaming errors for now; connection will just end
    } finally {
      response.end();
    }

    return;
  }
}
