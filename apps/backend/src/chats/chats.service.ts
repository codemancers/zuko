import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { RequestWithUser } from '@zuko/core';
import type { UIMessage } from 'ai';
import { toBaseMessages } from '@ai-sdk/langchain';
import type { ContextEntityReference, MessageMetadata } from '../types/chat';
import { getActiveOrganizationId } from '../common/auth/get-organization-id';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LangsmithService } from '../langsmith/langsmith.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SpritesService } from '../sprites/sprites.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChatsRepository } from './chats.repository';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SandboxLifecycleService } from '../sandbox-lifecycle/sandbox-lifecycle.service';

@Injectable()
export class ChatsService {
  constructor(
    private readonly chatsRepository: ChatsRepository,
    private readonly prisma: PrismaService,
    private readonly langsmithService: LangsmithService,
    private readonly spritesService: SpritesService,
    private readonly sandboxLifecycle: SandboxLifecycleService,
  ) {}

  /**
   * Create a new chat with a generated threadId
   * Automatically adds the creator as a participant
   */
  async create(userId: number, participantIds: number[] = []) {
    const threadId = randomUUID();
    return this.chatsRepository.createChat(userId, participantIds, threadId);
  }

  /**
   * Find all chats where user is a participant
   */
  async findAllByUser(userId: number) {
    return this.chatsRepository.findChatsByUser(userId);
  }

  /**
   * Find a specific chat by ID
   */
  async findOne(chatId: number) {
    const chat = await this.chatsRepository.findChatById(chatId);

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat;
  }

  /**
   * Check if a user is a participant in a chat
   */
  async isParticipant(chatId: number, userId: number): Promise<boolean> {
    const participant = await this.chatsRepository.findParticipant(
      chatId,
      userId,
    );
    return !!participant;
  }

  /**
   * Add a participant to a chat
   */
  async addParticipant(chatId: number, userId: number) {
    await this.findOne(chatId);
    return this.chatsRepository.addParticipant(chatId, userId);
  }

  /**
   * Remove a participant from a chat
   */
  async removeParticipant(chatId: number, userId: number) {
    await this.chatsRepository.removeParticipant(chatId, userId);
    return { success: true };
  }

  /**
   * Update chat title
   */
  async updateTitle(chatId: number, title: string) {
    return this.chatsRepository.updateTitle(chatId, title);
  }

  /**
   * Delete a chat
   */
  async delete(chatId: number) {
    await this.chatsRepository.deleteChat(chatId);
    return { success: true };
  }

  /**
   * Auto-generate a chat title from the first user message
   */
  async autoGenerateTitle(chatId: number, firstMessage: string) {
    // Take first 25 chars for concise sidebar display
    const title =
      firstMessage.length > 25
        ? firstMessage.substring(0, 22) + '...'
        : firstMessage;

    return this.updateTitle(chatId, title);
  }

  async ensureUserIsParticipant(chatId: number, userId: number) {
    const isParticipant = await this.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this chat');
    }
  }

  async getChatForUser(chatId: number, userId: number) {
    await this.ensureUserIsParticipant(chatId, userId);
    return this.findOne(chatId);
  }

  async getOrganizationId(req: RequestWithUser) {
    return getActiveOrganizationId(req, this.prisma);
  }

  async getMessagesForUser(chatId: number, userId: number) {
    const chat = await this.getChatForUser(chatId, userId);
    const threadId = chat.threadId;
    const sandboxUrl = chat.sandboxes[0]?.url ?? '';

    // Architecture 1: agent always runs on the backend process, not inside the sprite.
    // The sprite is used only for tool execution via its REST API.
    const agentUrl = process.env.LANGSMITH_SERVER_URL ?? 'http://localhost:8080';
    let values: { messages: unknown[]; contextEntities: unknown[] };
    try {
      const state: any = await this.langsmithService.getThreadState(
        threadId,
        agentUrl,
      );
      values = state?.values ?? { messages: [], contextEntities: [] };
    } catch {
      values = { messages: [], contextEntities: [] };
    }

    const rawMessages: unknown[] = Array.isArray(values.messages)
      ? values.messages
      : [];
    const messages = rawMessages
      .map((msg: any) => {
        const role =
          msg.type === 'human'
            ? 'user'
            : msg.type === 'ai'
              ? 'assistant'
              : (msg.type ?? 'system');

        const content =
          typeof msg.content === 'string'
            ? msg.content
            : typeof msg.text === 'string'
              ? msg.text
              : '';

        if (!content || !content.trim()) {
          return null;
        }

        return { role, content };
      })
      .filter((m): m is { role: string; content: string } => m !== null);

    const contextEntities =
      Array.isArray(values.contextEntities) && values.contextEntities.length > 0
        ? (values.contextEntities as unknown[])
        : [];

    const sandboxId = chat.sandboxes[0]?.id ?? null;

    return { messages, contextEntities, sandboxId };
  }

  async prepareChatRun(input: {
    chatId: number;
    userId: number;
    messages: UIMessage[];
    contextEntities?: ContextEntityReference[];
  }) {
    const { chatId, userId, messages } = input;
    const lastMessage = messages[messages.length - 1];
    const contextEntities =
      (lastMessage?.metadata as MessageMetadata)?.contextEntities ??
      input.contextEntities ??
      [];

    const chat = await this.getChatForUser(chatId, userId);
    const threadId = chat.threadId;
    const spriteName = `${chatId}-${threadId}`;

    const spritesEnabled = process.env.SPRITES_ENABLED !== 'false';
    let sandbox = chat.sandboxes[0];
    if (process.env.NODE_ENV === 'test') {
      sandbox = await this.chatsRepository.createSandboxForChat(
        chat.id,
        process.env.E2E_SANDBOX ?? '',
        process.env.E2E_SANDBOX_URL ?? '',
      );
    } else if (!sandbox && spritesEnabled) {
      const sprite = await this.spritesService.createSprite(spriteName);
      await this.spritesService.setupSprite(spriteName);
      sandbox = await this.chatsRepository.createSandboxForChat(
        chat.id,
        spriteName,
        sprite.url,
      );
      await this.sandboxLifecycle.markActive(sandbox.id);
    } else if (sandbox?.lifecycleState === 'hibernated' && spritesEnabled) {
      await this.sandboxLifecycle.resume(sandbox.id);
    }

    if (!chat.title && messages.length === 1) {
      const firstMessage = messages[0];
      const text =
        firstMessage.parts
          ?.filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('') || ((firstMessage as any).content as string);

      if (text?.trim()) {
        this.autoGenerateTitle(chatId, text.trim()).catch((error) => {
          console.error('Error auto-generating title', error);
        });
      }
    }

    const supportedRoles = new Set(['user', 'assistant', 'system']);
    const filteredMessages = messages.filter((msg) =>
      supportedRoles.has(msg.role),
    );
    const langchainMessages = await toBaseMessages(filteredMessages);

    // Refresh inactivity deadline after each chat run
    if (spritesEnabled && sandbox) {
      this.sandboxLifecycle.refreshActivity(sandbox.id).catch(() => {});
    }

    // Architecture 1: agent always runs on the backend process.
    // sandboxUrl points to the local LangGraph server, NOT the sprite.
    const sandboxUrl =
      process.env.LANGSMITH_SERVER_URL ?? 'http://localhost:8080';

    return {
      chatId,
      threadId,
      sandboxUrl,
      spriteName: spritesEnabled ? spriteName : undefined,
      contextEntities,
      langchainMessages,
    };
  }
}
