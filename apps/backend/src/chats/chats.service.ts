import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ChatsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new chat with a generated threadId
   * Automatically adds the creator as a participant
   */
  async create(userId: number, participantIds: number[] = []) {
    const threadId = randomUUID();

    // Create chat and add participants in a transaction
    const chat = await this.prisma.$transaction(async (tx) => {
      const newChat = await tx.chat.create({
        data: {
          threadId,
          createdById: userId,
          participants: {
            create: [
              // Add creator as participant
              { userId },
              // Add other participants
              ...participantIds
                .filter((id) => id !== userId) // Don't duplicate creator
                .map((id) => ({ userId: id })),
            ],
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
      });

      return newChat;
    });

    return chat;
  }

  /**
   * Find all chats where user is a participant
   */
  async findAllByUser(userId: number) {
    const chats = await this.prisma.chat.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return chats;
  }

  /**
   * Find a specific chat by ID
   */
  async findOne(chatId: number) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat;
  }

  /**
   * Check if a user is a participant in a chat
   */
  async isParticipant(chatId: number, userId: number): Promise<boolean> {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    return !!participant;
  }

  /**
   * Add a participant to a chat
   */
  async addParticipant(chatId: number, userId: number) {
    // Verify chat exists
    await this.findOne(chatId);

    const participant = await this.prisma.chatParticipant.create({
      data: {
        chatId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return participant;
  }

  /**
   * Remove a participant from a chat
   */
  async removeParticipant(chatId: number, userId: number) {
    await this.prisma.chatParticipant.delete({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    return { success: true };
  }

  /**
   * Update chat title
   */
  async updateTitle(chatId: number, title: string) {
    const chat = await this.prisma.chat.update({
      where: { id: chatId },
      data: { title },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return chat;
  }

  /**
   * Delete a chat
   */
  async delete(chatId: number) {
    await this.prisma.chat.delete({
      where: { id: chatId },
    });

    return { success: true };
  }

  /**
   * Auto-generate a chat title from the first user message
   */
  async autoGenerateTitle(chatId: number, firstMessage: string) {
    // Take first 25 chars for concise sidebar display
    const title = firstMessage.length > 25
      ? firstMessage.substring(0, 22) + '...'
      : firstMessage;

    return this.updateTitle(chatId, title);
  }
}
