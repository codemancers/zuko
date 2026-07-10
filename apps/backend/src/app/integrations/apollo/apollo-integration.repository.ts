import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

const APOLLO_PROVIDER = 'apollo';

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
    connectedById: number,
    nangoConnectionId: string,
  ) {
    return this.prisma.connection.upsert({
      where: {
        organizationId_provider: { organizationId, provider: APOLLO_PROVIDER },
      },
      create: {
        organizationId,
        provider: APOLLO_PROVIDER,
        connectedById,
        nangoConnectionId,
      },
      update: {
        connectedById,
        connectedAt: new Date(),
        nangoConnectionId,
      },
    });
  }

  async delete(organizationId: number) {
    return this.prisma.connection.delete({
      where: {
        organizationId_provider: { organizationId, provider: APOLLO_PROVIDER },
      },
    });
  }
}
