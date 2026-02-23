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
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { ChatsService } from './chats.service';
import { OrchestratorService } from '@zuko/agents';

@Controller('chats')
@UseGuards(AuthGuard)
export class ChatsController {
  constructor(
    private chatsService: ChatsService,
    private orchestratorService: OrchestratorService
  ) {}

  /**
   * Create a new chat
   * POST /api/chats
   */
  @Post()
  async create(
    @Req() req,
    @Body() body: { participantIds?: number[] }
  ) {
    const userId = parseInt(req.user.id, 10);
    const chat = await this.chatsService.create(userId, body.participantIds);

    return {
      id: chat.id,
      threadId: chat.threadId,
      title: chat.title,
      createdAt: chat.createdAt,
      participants: chat.participants.map(p => ({
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
  async findAll(@Req() req) {
    const userId = parseInt(req.user.id, 10);
    const chats = await this.chatsService.findAllByUser(userId);

    return {
      chats: chats.map(chat => ({
        id: chat.id,
        threadId: chat.threadId,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        createdBy: chat.createdBy,
        participants: chat.participants.map(p => ({
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
  @Get(':id')
  async findOne(@Req() req, @Param('id') id: string) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);
    const chat = await this.chatsService.findOne(chatId);

    // Verify user is a participant
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this chat');
    }

    return {
      id: chat.id,
      threadId: chat.threadId,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      createdBy: chat.createdBy,
      participants: chat.participants.map(p => ({
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
  @Get(':id/messages')
  async getMessages(@Req() req, @Param('id') id: string) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);

    // Verify user is a participant
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this chat');
    }

    // Get the chat to extract threadId
    const chat = await this.chatsService.findOne(chatId);

    // Fetch messages and contextEntities from LangGraph checkpoints
    const { messages, contextEntities } = await this.orchestratorService.getMessages(chat.threadId);

    return { messages, contextEntities };
  }

  /**
   * Update chat title
   * PATCH /api/chats/:id
   */
  @Patch(':id')
  async update(
    @Req() req,
    @Param('id') id: string,
    @Body() body: { title: string }
  ) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);

    // Verify user is a participant
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this chat');
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
  @Delete(':id')
  async delete(@Req() req, @Param('id') id: string) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);

    // Verify user is a participant
    const isParticipant = await this.chatsService.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this chat');
    }

    await this.chatsService.delete(chatId);

    return { success: true };
  }

  /**
   * Add a participant to a chat
   * POST /api/chats/:id/participants
   */
  @Post(':id/participants')
  async addParticipant(
    @Req() req,
    @Param('id') id: string,
    @Body() body: { userId: number }
  ) {
    const currentUserId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);

    // Verify current user is a participant
    const isParticipant = await this.chatsService.isParticipant(chatId, currentUserId);
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this chat');
    }

    const participant = await this.chatsService.addParticipant(chatId, body.userId);

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
  @Delete(':id/participants/:userId')
  async removeParticipant(
    @Req() req,
    @Param('id') id: string,
    @Param('userId') userIdParam: string
  ) {
    const currentUserId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);
    const targetUserId = parseInt(userIdParam, 10);

    // Verify current user is a participant
    const isParticipant = await this.chatsService.isParticipant(chatId, currentUserId);
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this chat');
    }

    await this.chatsService.removeParticipant(chatId, targetUserId);

    return { success: true };
  }
}
