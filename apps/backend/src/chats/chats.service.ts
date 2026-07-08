import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChatsRepository } from './chats.repository';

@Injectable()
export class ChatsService {
  constructor(private readonly chatsRepository: ChatsRepository) {}

  async create(userId: number, participantIds: number[] = []) {
    const threadId = randomUUID();
    return this.chatsRepository.createChat(userId, participantIds, threadId);
  }

  async findAllByUser(userId: number) {
    return this.chatsRepository.findChatsByUser(userId);
  }

  async findOne(chatId: number) {
    const chat = await this.chatsRepository.findChatById(chatId);
    if (!chat) throw new NotFoundException('Chat not found');
    return chat;
  }

  async isParticipant(chatId: number, userId: number): Promise<boolean> {
    const participant = await this.chatsRepository.findParticipant(
      chatId,
      userId,
    );
    return !!participant;
  }

  async addParticipant(chatId: number, userId: number) {
    await this.findOne(chatId);
    return this.chatsRepository.addParticipant(chatId, userId);
  }

  async removeParticipant(chatId: number, userId: number) {
    await this.chatsRepository.removeParticipant(chatId, userId);
    return { success: true };
  }

  async updateTitle(chatId: number, title: string) {
    return this.chatsRepository.updateTitle(chatId, title);
  }

  async delete(chatId: number) {
    await this.chatsRepository.deleteChat(chatId);
    return { success: true };
  }

  async autoGenerateTitle(chatId: number, firstMessage: string) {
    const title =
      firstMessage.length > 25
        ? firstMessage.substring(0, 22) + '...'
        : firstMessage;
    return this.updateTitle(chatId, title);
  }

  async ensureUserIsParticipant(chatId: number, userId: number) {
    const isParticipant = await this.isParticipant(chatId, userId);
    if (!isParticipant)
      throw new ForbiddenException('Not a participant in this chat');
  }

  async getChatForUser(chatId: number, userId: number) {
    await this.ensureUserIsParticipant(chatId, userId);
    return this.findOne(chatId);
  }

  async getMessagesForUser(chatId: number, userId: number) {
    await this.getChatForUser(chatId, userId);
    const rows = await this.chatsRepository.listMessages(chatId);
    const messages = rows.map((r) => ({
      id: r.id,
      role: r.role as 'user' | 'assistant' | 'system',
      parts: r.parts,
    }));
    return { messages, contextEntities: [] };
  }

  async saveExchangeMessages(
    chatId: number,
    dto: { userMessage: string; assistantMessage: string },
    userId: number,
  ) {
    await this.ensureUserIsParticipant(chatId, userId);

    const existing = await this.chatsRepository.listMessages(chatId);
    const isFirstMessage = existing.length === 0;

    await this.chatsRepository.insertUserMessage(chatId, dto.userMessage);
    const assistantId = randomUUID();
    await this.chatsRepository.upsertAssistantMessage(assistantId, chatId, [
      { type: 'text', text: dto.assistantMessage },
    ]);

    if (isFirstMessage && dto.userMessage.trim()) {
      this.autoGenerateTitle(chatId, dto.userMessage.trim()).catch(() => {});
    }

    return { ok: true };
  }
}
