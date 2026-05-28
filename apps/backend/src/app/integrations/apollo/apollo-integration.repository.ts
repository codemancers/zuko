import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

const APOLLO_PROVIDER = 'apollo';

export interface CreateConnectionInput {
  organizationId: number;
  connectedById: number;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export interface UpdateConnectionInput {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  connectedById: number;
  connectedAt: Date;
}

@Injectable()
export class ApolloIntegrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrganizationId(organizationId: number) {
    return this.prisma.connection.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: APOLLO_PROVIDER },
      },
      include: { connectedBy: { select: { email: true } } },
    });
  }

  async upsert(
    organizationId: number,
    createInput: CreateConnectionInput,
    updateInput: UpdateConnectionInput,
  ) {
    return this.prisma.connection.upsert({
      where: {
        organizationId_provider: { organizationId, provider: APOLLO_PROVIDER },
      },
      create: { ...createInput, provider: APOLLO_PROVIDER },
      update: updateInput,
    });
  }

  async delete(organizationId: number) {
    return this.prisma.connection.delete({
      where: {
        organizationId_provider: { organizationId, provider: APOLLO_PROVIDER },
      },
    });
  }

  async createOAuthState(state: string, value: string, expiresAt: Date) {
    return this.prisma.verification.create({
      data: { identifier: `apollo_oauth:${state}`, value, expiresAt },
    });
  }

  async findOAuthState(state: string) {
    return this.prisma.verification.findFirst({
      where: {
        identifier: `apollo_oauth:${state}`,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async deleteOAuthState(id: number) {
    return this.prisma.verification.delete({ where: { id } });
  }
}
