import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { generateId } from 'ai';
import type { Response } from 'express';
import type { ContextEntityReference } from '../types/chat';
import { toUIMessageStream } from '@ai-sdk/langchain';
import type { UIMessage } from 'ai';
import type { RequestWithUser } from '@zuko/core';
import { ChatsService } from '../chats/chats.service';
import { ChatsRepository } from '../chats/chats.repository';
import { AgentService } from '../agent/agent.service';

@Controller('v1')
export class ChatController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly chatsRepository: ChatsRepository,
    private readonly agentService: AgentService,
  ) {}

  @Post('chat')
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
      typeof rawChatId === 'string' ? parseInt(rawChatId, 10) : rawChatId;
    const userId = parseInt(req.user.id, 10);
    const organizationId = await this.chatsService.getOrganizationId(req);
    const preparedRun = await this.chatsService.prepareChatRun({
      chatId,
      userId,
      messages,
      contextEntities: body.contextEntities,
    });

    // Persist user message
    const lastUserMessage = messages.findLast((m) => m.role === 'user');
    if (lastUserMessage) {
      const text =
        lastUserMessage.parts
          ?.filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('') ??
        (lastUserMessage as any).content ??
        '';
      if (text.trim()) {
        await this.chatsRepository.insertUserMessage(chatId, text);
      }
    }

    // Set SSE headers for the client
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Thread-Id', preparedRun.threadId);
    response.setHeader('X-Chat-Id', chatId);
    response.flushHeaders();

    // Run agent in-process (gather-style) — no separate LangGraph server needed
    const graphStream = await this.agentService.stream({
      messages: preparedRun.langchainMessages,
      contextEntities: preparedRun.contextEntities,
      userId,
      organizationId,
      sandbox: preparedRun.sandbox,
    });

    const uiStream = toUIMessageStream(graphStream as any);
    const assistantId = generateId();
    let accumulatedText = '';

    try {
      const reader = (uiStream as ReadableStream).getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if ((value as any).type === 'text-delta') {
            accumulatedText += (value as any).delta;
          }
          response.write(`data: ${JSON.stringify(value)}\n\n`);
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      console.error('[ChatController] streaming error:', err);
    } finally {
      // Persist assistant response
      if (accumulatedText.trim()) {
        this.chatsRepository
          .upsertAssistantMessage(assistantId, chatId, [
            { type: 'text', text: accumulatedText },
          ])
          .catch((err) =>
            console.error(
              '[ChatController] failed to persist assistant message:',
              err,
            ),
          );
      }
      response.end();
    }

    return;
  }
}
