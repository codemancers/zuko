import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { type SandboxLifecycleState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createChat(userId: number, participantIds: number[], threadId: string) {
    return this.prisma.chat.create({
      data: {
        threadId,
        createdById: userId,
        participants: {
          create: [
            { userId },
            ...participantIds
              .filter((id) => id !== userId)
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
  }

  findChatsByUser(userId: number) {
    return this.prisma.chat.findMany({
      where: {
        participants: {
          some: { userId },
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
        sandboxes: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  findChatById(chatId: number) {
    return this.prisma.chat.findUnique({
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
        sandboxes: true,
      },
    });
  }

  findParticipant(chatId: number, userId: number) {
    return this.prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });
  }

  addParticipant(chatId: number, userId: number) {
    return this.prisma.chatParticipant.create({
      data: { chatId, userId },
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
  }

  removeParticipant(chatId: number, userId: number) {
    return this.prisma.chatParticipant.delete({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });
  }

  updateTitle(chatId: number, title: string) {
    return this.prisma.chat.update({
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
  }

  deleteChat(chatId: number) {
    return this.prisma.chat.delete({
      where: { id: chatId },
    });
  }

  createSandboxForChat(chatId: number, name: string, url: string) {
    return this.prisma.sandbox.create({
      data: {
        name,
        url,
        chats: {
          connect: {
            id: chatId,
          },
        },
      },
    });
  }

  insertUserMessage(chatId: number, text: string): Promise<string> {
    const id = randomUUID();
    return this.prisma.chatMessage
      .create({
        data: {
          id,
          chatId,
          role: 'user',
          parts: [{ type: 'text', text }],
        },
      })
      .then(() => id);
  }

  upsertAssistantMessage(
    id: string,
    chatId: number,
    parts: unknown[],
  ): Promise<void> {
    return this.prisma.chatMessage
      .upsert({
        where: { id },
        create: { id, chatId, role: 'assistant', parts: parts as any },
        update: { parts: parts as any },
      })
      .then(() => undefined);
  }

  listMessages(chatId: number) {
    return this.prisma.chatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  updateSandboxLifecycle(
    sandboxId: number,
    data: {
      lifecycleState?: SandboxLifecycleState;
      lastActivityAt?: Date;
      hibernateAfter?: Date | null;
      lifecycleError?: string | null;
    },
  ) {
    return this.prisma.sandbox.update({
      where: { id: sandboxId },
      data,
    });
  }
}
