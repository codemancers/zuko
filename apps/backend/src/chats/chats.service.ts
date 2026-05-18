import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { RequestWithUser } from '@zuko/core';
import type { UIMessage } from 'ai';
import { toBaseMessages } from '@ai-sdk/langchain';
import type { ContextEntityReference, MessageMetadata } from '../types/chat';
import { getActiveOrganizationId } from '../common/auth/get-organization-id';
import { PrismaService } from '../prisma/prisma.service';
import { SpritesService } from '../sprites/sprites.service';
import { ChatsRepository } from './chats.repository';
import { SandboxLifecycleService } from '../sandbox-lifecycle/sandbox-lifecycle.service';
import { AgentAuthBridgeService } from '../app/agent-auth-bridge/agent-auth-bridge.service';
import {
  LocalSandbox,
  SpriteSandbox,
  type Sandbox,
} from '../agent/tools/sandbox';

const WORKING_DIR = process.env.WORKING_DIR ?? '/home/sprite/zuko';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    private readonly chatsRepository: ChatsRepository,
    private readonly prisma: PrismaService,
    private readonly spritesService: SpritesService,
    private readonly sandboxLifecycle: SandboxLifecycleService,
    private readonly agentAuthBridge: AgentAuthBridgeService,
  ) {}

  /**
   * Create a new chat with a generated threadId.
   * Registers a per-chat delegated agent tied to the user.
   */
  async create(userId: number, participantIds: number[] = []) {
    const threadId = randomUUID();
    const chat = await this.chatsRepository.createChat(
      userId,
      participantIds,
      threadId,
    );

    try {
      const { agentId } = await this.agentAuthBridge.registerDelegatedAgent({
        userId,
        chatId: chat.id,
      });
      await this.prisma.chat.update({
        where: { id: chat.id },
        data: { agentId },
      });
      return { ...chat, agentId };
    } catch (err) {
      this.logger.error('Failed to register delegated agent for chat', {
        chatId: chat.id,
        userId,
        err,
      });
      throw new InternalServerErrorException(
        'Agent registration failed — please try again',
      );
    }
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
   * Delete a chat — also revokes the associated delegated agent.
   */
  async delete(chatId: number) {
    const chat = await this.chatsRepository.findChatById(chatId);
    if (chat?.agentId) {
      await this.agentAuthBridge.revokeAgent(chat.agentId);
    }
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
    const sandboxId = chat.sandboxes[0]?.id ?? null;
    const rows = await this.chatsRepository.listMessages(chatId);
    const messages = rows.map((r) => ({
      id: r.id,
      role: r.role as 'user' | 'assistant' | 'system',
      parts: r.parts,
    }));
    return { messages, contextEntities: [], sandboxId };
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
        chat.agentId,
      );
    } else if (!sandbox && spritesEnabled) {
      const sprite = await this.spritesService.createSprite(spriteName);
      await this.spritesService.setupSprite(spriteName);
      // Store sprite.name from API response (e.g. "zuko-24-uuid"), not local
      // spriteName variable ("24-uuid"), so start/stop calls use the correct name.
      sandbox = await this.chatsRepository.createSandboxForChat(
        chat.id,
        sprite.name,
        sprite.url,
        chat.agentId,
      );
      await this.sandboxLifecycle.markActive(sandbox.id);
    } else if (sandbox && spritesEnabled) {
      // Ensure the sprite is warm regardless of what our DB says — Fly can
      // auto-suspend a sprite independently, causing a state mismatch where
      // DB says 'active' but the sprite is actually cold. startSprite is
      // idempotent (no-op if already running).
      if (sandbox.lifecycleState === 'hibernated') {
        await this.sandboxLifecycle.resume(sandbox.id);
      } else {
        await this.spritesService.startSprite(sandbox.name).catch(() => {});
        await this.sandboxLifecycle.markActive(sandbox.id);
      }
    } else if (
      sandbox &&
      !spritesEnabled &&
      sandbox.lifecycleState !== 'active'
    ) {
      // When sprites are disabled (local dev), always reset to active so the
      // badge doesn't show a stale failed/hibernated state.
      await this.sandboxLifecycle.markActive(sandbox.id);
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

    // Build sandbox instance — passed directly to graph.stream() configurable (gather-style).
    const sandboxInstance: Sandbox =
      spritesEnabled && sandbox
        ? new SpriteSandbox(
            WORKING_DIR,
            sandbox.name,
            process.env.SPRITES_TOKEN ?? '',
          )
        : new LocalSandbox(WORKING_DIR);

    return {
      chatId,
      threadId,
      sandbox: sandboxInstance,
      contextEntities,
      langchainMessages,
    };
  }
}
