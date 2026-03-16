import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@thallesp/nestjs-better-auth";
import { ChatsService } from "./chats.service";
import type { RequestWithUser } from "@zuko/core";
import { LangsmithService } from "../langsmith/langsmith.service";

@Controller("chats")
@UseGuards(AuthGuard)
export class ChatsController {
  constructor(
    private chatsService: ChatsService,
    private readonly langsmithService: LangsmithService,
  ) {}

  /**
   * Create a new chat
   * POST /api/chats
   */
  @Post()
  async create(@Req() req: RequestWithUser, @Body() body: { participantIds?: number[] }) {
    const userId = parseInt(req.user.id, 10);
    const chat = await this.chatsService.create(userId, body.participantIds);

    try {
      await this.langsmithService.createThread(chat.threadId);
    } catch {
      // Chat is already created; thread will be created on first run if LangSmith was unavailable
    }

    return {
      id: chat.id,
      threadId: chat.threadId,
      title: chat.title,
      createdAt: chat.createdAt,
      participants: chat.participants.map((p) => ({
        userId: p.user.id,
        name: p.user.name,
        email: p.user.email,
        image: p.user.image,
        joinedAt: p.joinedAt,
      })),
    };
  }

  /**
   * List all chats for the current user
   * GET /api/chats
   */
  @Get()
  async findAll(@Req() req: RequestWithUser) {
    const userId = parseInt(req.user.id, 10);
    const chats = await this.chatsService.findAllByUser(userId);

    return {
      chats: chats.map((chat) => ({
        id: chat.id,
        threadId: chat.threadId,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        createdBy: chat.createdBy,
        participants: chat.participants.map((p) => ({
          userId: p.user.id,
          name: p.user.name,
          email: p.user.email,
          image: p.user.image,
          joinedAt: p.joinedAt,
        })),
      })),
    };
  }

  /**
   * Get a specific chat
   * GET /api/chats/:id
   */
  @Get(":id")
  async findOne(@Req() req: RequestWithUser, @Param("id") id: string) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);
    const chat = await this.chatsService.findOne(chatId);

    // Verify user is a participant
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException("Not a participant in this chat");
    }

    return {
      id: chat.id,
      threadId: chat.threadId,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      createdBy: chat.createdBy,
      participants: chat.participants.map((p) => ({
        userId: p.user.id,
        name: p.user.name,
        email: p.user.email,
        image: p.user.image,
        joinedAt: p.joinedAt,
      })),
    };
  }

  /**
   * Get message history and context entities for a chat
   * GET /api/chats/:id/messages
   */
  @Get(":id/messages")
  async getMessages(@Req() req: RequestWithUser, @Param("id") id: string) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);

    // Verify user is a participant
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException("Not a participant in this chat");
    }

    // Get the chat to extract threadId
    const chat = await this.chatsService.findOne(chatId);

    const threadId = chat.threadId;

      const state: any = await this.langsmithService.getThreadState(threadId);
      const values = state?.values ?? {};

      // Expect messages array and optional contextEntities in thread state values
      const rawMessages: any[] = Array.isArray(values.messages)
        ? values.messages
        : [];

      const messages = rawMessages
        .map((msg) => {
          const role =
            msg.type === "human"
              ? "user"
              : msg.type === "ai"
                ? "assistant"
                : msg.type ?? "system";

          const content =
            typeof msg.content === "string"
              ? msg.content
              : typeof msg.text === "string"
                ? msg.text
                : "";

          if (!content || !content.trim()) {
            return null;
          }

          return { role, content };
        })
        .filter((m): m is { role: string; content: string } => m !== null);

      const contextEntities =
        Array.isArray(values.contextEntities) && values.contextEntities.length > 0
          ? values.contextEntities
          : [];

      return { messages, contextEntities };
  }

  /**
   * Update chat title
   * PATCH /api/chats/:id
   */
  @Patch(":id")
  async update(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body() body: { title: string },
  ) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);

    // Verify user is a participant
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException("Not a participant in this chat");
    }

    const chat = await this.chatsService.updateTitle(chatId, body.title);

    return {
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
    };
  }

  /**
   * Delete a chat
   * DELETE /api/chats/:id
   */
  @Delete(":id")
  async delete(@Req() req: RequestWithUser, @Param("id") id: string) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);

    // Verify user is a participant
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException("Not a participant in this chat");
    }

    await this.chatsService.delete(chatId);

    return { success: true };
  }

  /**
   * Add a participant to a chat
   * POST /api/chats/:id/participants
   */
  @Post(":id/participants")
  async addParticipant(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body() body: { userId: number },
  ) {
    const currentUserId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);

    // Verify current user is a participant
    const isParticipant = await this.chatsService.isParticipant(
      chatId,
      currentUserId,
    );
    if (!isParticipant) {
      throw new ForbiddenException("Not a participant in this chat");
    }

    const participant = await this.chatsService.addParticipant(
      chatId,
      body.userId,
    );

    return {
      userId: participant.user.id,
      name: participant.user.name,
      email: participant.user.email,
      image: participant.user.image,
      joinedAt: participant.joinedAt,
    };
  }

  /**
   * Remove a participant from a chat
   * DELETE /api/chats/:id/participants/:userId
   */
  @Delete(":id/participants/:userId")
  async removeParticipant(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Param("userId") userIdParam: string,
  ) {
    const currentUserId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);
    const targetUserId = parseInt(userIdParam, 10);

    // Verify current user is a participant
    const isParticipant = await this.chatsService.isParticipant(
      chatId,
      currentUserId,
    );
    if (!isParticipant) {
      throw new ForbiddenException("Not a participant in this chat");
    }

    await this.chatsService.removeParticipant(chatId, targetUserId);

    return { success: true };
  }
}
