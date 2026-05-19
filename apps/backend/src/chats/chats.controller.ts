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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { ChatsService } from './chats.service';
import type { RequestWithUser } from '@zuko/core';

export class CreateChatBodyDto {
  @ApiPropertyOptional({
    type: [Number],
    description: 'Optional list of participant user IDs',
    example: [2, 3],
  })
  participantIds?: number[];
}

export class UpdateChatTitleDto {
  @ApiProperty({ example: 'Project kickoff discussion' })
  title!: string;
}

export class AddChatParticipantDto {
  @ApiProperty({ type: Number, description: 'User ID to add', example: 5 })
  userId!: number;
}

@ApiTags('Chats')
@ApiBearerAuth('session')
@Controller('chats')
@UseGuards(AuthGuard)
export class ChatsController {
  constructor(private chatsService: ChatsService) {}

  /**
   * Create a new chat
   * POST /api/chats
   */
  @Post()
  @ApiOperation({ summary: 'Create a new chat' })
  @ApiBody({ type: CreateChatBodyDto })
  @ApiResponse({ status: 201, description: 'Chat created' })
  async create(
    @Req() req: RequestWithUser,
    @Body() body: { participantIds?: number[] },
  ) {
    const userId = parseInt(req.user.id, 10);
    const chat = await this.chatsService.create(userId, body.participantIds);

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
  @ApiOperation({ summary: 'List all chats for the current user' })
  @ApiResponse({ status: 200, description: 'Chat list' })
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
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific chat' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Chat details' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);
    const chat = await this.chatsService.getChatForUser(chatId, userId);

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
  @Get(':id/messages')
  @ApiOperation({ summary: 'Get message history for a chat' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Message history' })
  async getMessages(@Req() req: RequestWithUser, @Param('id') id: string) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);
    return this.chatsService.getMessagesForUser(chatId, userId);
  }

  /**
   * Update chat title
   * PATCH /api/chats/:id
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update chat title' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateChatTitleDto })
  @ApiResponse({ status: 200, description: 'Chat updated' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { title: string },
  ) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);
    await this.chatsService.ensureUserIsParticipant(chatId, userId);

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
  @ApiOperation({ summary: 'Delete a chat' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Chat deleted' })
  async delete(@Req() req: RequestWithUser, @Param('id') id: string) {
    const userId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);
    await this.chatsService.ensureUserIsParticipant(chatId, userId);

    await this.chatsService.delete(chatId);

    return { success: true };
  }

  /**
   * Add a participant to a chat
   * POST /api/chats/:id/participants
   */
  @Post(':id/participants')
  @ApiOperation({ summary: 'Add a participant to a chat' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: AddChatParticipantDto })
  @ApiResponse({ status: 201, description: 'Participant added' })
  async addParticipant(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { userId: number },
  ) {
    const currentUserId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);
    await this.chatsService.ensureUserIsParticipant(chatId, currentUserId);

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
  @Delete(':id/participants/:userId')
  @ApiOperation({ summary: 'Remove a participant from a chat' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({ status: 200, description: 'Participant removed' })
  async removeParticipant(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('userId') userIdParam: string,
  ) {
    const currentUserId = parseInt(req.user.id, 10);
    const chatId = parseInt(id, 10);
    const targetUserId = parseInt(userIdParam, 10);
    await this.chatsService.ensureUserIsParticipant(chatId, currentUserId);

    await this.chatsService.removeParticipant(chatId, targetUserId);

    return { success: true };
  }
}
