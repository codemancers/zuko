import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { generateId } from 'ai';
import type { UIMessageChunk, UIMessage } from 'ai';
import type { Response } from 'express';
import type { RequestWithUser } from '@zuko/core';
import type { ContextEntityReference } from '../types/chat';

export class ChatMessageDto {
  @ApiProperty({
    type: Array,
    description: 'Array of AI SDK UIMessage objects',
  })
  messages!: UIMessage[];

  @ApiProperty({ description: 'Chat ID (number or string)' })
  chatId!: string | number;

  @ApiPropertyOptional({
    type: Array,
    description: 'Context entity references for the AI agent',
  })
  contextEntities?: ContextEntityReference[];
}

export class StopChatDto {
  @ApiProperty({ description: 'Chat ID (number or string)' })
  chatId!: string | number;
}
import { ChatsService } from '../chats/chats.service';
import { ChatsRepository } from '../chats/chats.repository';
import { AgentService } from '../agent/agent.service';
import { ChatStreamRegistry } from './chat-stream.registry';
import { convertChatStreamToUiMessageStream } from './convert-stream';

@ApiTags('Chat Stream')
@ApiBearerAuth('session')
@Controller('v1')
export class ChatController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly chatsRepository: ChatsRepository,
    private readonly agentService: AgentService,
    private readonly streamRegistry: ChatStreamRegistry,
  ) {}

  @Post('chat')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Start an AI chat stream (SSE)' })
  @ApiBody({ type: ChatMessageDto })
  @ApiResponse({
    status: 200,
    description: 'Server-sent event stream of UIMessageChunks',
    content: { 'text/event-stream': {} },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
    const lastUserMessage = [...messages]
      .reverse()
      .find((m: UIMessage) => m.role === 'user');
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

    // Claim stream slot — aborts any existing run for this chat (dedup)
    const aborter = this.streamRegistry.claim(chatId);

    // SSE headers
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Thread-Id', preparedRun.threadId);
    response.setHeader('X-Chat-Id', chatId);
    response.flushHeaders();

    // Stable assistant id — emit our own start chunk first so the client
    // has a stable message id before the graph stream begins.
    const assistantId = generateId();
    const startChunk: UIMessageChunk = {
      type: 'start',
      messageId: assistantId,
    };
    response.write(`data: ${JSON.stringify(startChunk)}\n\n`);

    const chatForAgent = await this.chatsService.findOne(chatId);
    const agentId = chatForAgent.agentId ?? undefined;

    const graphStream = await this.agentService.stream({
      messages: preparedRun.langchainMessages,
      contextEntities: preparedRun.contextEntities,
      userId,
      organizationId,
      sandbox: preparedRun.sandbox,
      signal: aborter.signal,
      agentId,
    });

    // suppressStart: true — drop the converter's own start chunk so the
    // client sees exactly one start (the one we emitted above with assistantId).
    const uiStream = convertChatStreamToUiMessageStream(graphStream, {
      suppressStart: true,
    });

    let accumulatedText = '';

    try {
      const reader = uiStream.getReader();
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
      this.streamRegistry.release(chatId, aborter);

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

  /**
   * Cancel the active agent run for this chat.
   * POST /api/v1/chat/stop
   */
  @Post('chat/stop')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel the active agent run for a chat' })
  @ApiBody({ type: StopChatDto })
  @ApiResponse({ status: 204, description: 'Stream cancelled' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async stop(
    @Body() body: { chatId: string | number },
    @Req() req: RequestWithUser,
  ) {
    const chatId =
      typeof body.chatId === 'string' ? parseInt(body.chatId, 10) : body.chatId;
    const userId = parseInt(req.user.id, 10);

    // Verify participant before allowing stop
    await this.chatsService.ensureUserIsParticipant(chatId, userId);
    this.streamRegistry.stop(chatId);
  }
}
