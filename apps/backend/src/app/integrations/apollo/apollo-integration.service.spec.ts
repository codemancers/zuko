import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApolloIntegrationService } from './apollo-integration.service';
import type { ApolloIntegrationRepository } from './apollo-integration.repository';
import type { NangoService } from '../../nango/nango.service';

describe('ApolloIntegrationService', () => {
  let service: ApolloIntegrationService;
  let repo: {
    upsert: ReturnType<typeof vi.fn>;
    findByOrganizationId: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let nango: {
    getConnection: ReturnType<typeof vi.fn>;
    deleteConnection: ReturnType<typeof vi.fn>;
    proxy: ReturnType<typeof vi.fn>;
  };

  const orgId = 9;
  // Nango generates connection IDs server-side (UUIDs).
  const connectionId = 'c6c6c195-154c-45f2-a734-f2e731e4196d';

  beforeEach(() => {
    repo = {
      upsert: vi.fn().mockResolvedValue(undefined),
      findByOrganizationId: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    nango = {
      getConnection: vi.fn().mockResolvedValue({
        credentials: { access_token: 'tok' },
        end_user: { id: '7', organization: { id: String(orgId) } },
      }),
      deleteConnection: vi.fn().mockResolvedValue(undefined),
      proxy: vi.fn(),
    };
    service = new ApolloIntegrationService(
      repo as unknown as ApolloIntegrationRepository,
      nango as unknown as NangoService,
    );
  });

  describe('recordConnection', () => {
    it('verifies ownership with Nango and upserts the record', async () => {
      await service.recordConnection(orgId, 7, connectionId);

      expect(nango.getConnection).toHaveBeenCalledWith(
        'apollo-oauth',
        connectionId,
      );
      expect(repo.upsert).toHaveBeenCalledWith(orgId, 7, connectionId);
    });

    it('rejects a connection that belongs to another org', async () => {
      nango.getConnection.mockResolvedValue({
        credentials: { access_token: 'tok' },
        end_user: { id: '7', organization: { id: '999' } },
      });

      await expect(
        service.recordConnection(orgId, 7, connectionId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('rejects a connection without end-user organisation metadata', async () => {
      nango.getConnection.mockResolvedValue({
        credentials: { access_token: 'tok' },
      });

      await expect(
        service.recordConnection(orgId, 7, connectionId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('maps Nango verification failures to 502', async () => {
      nango.getConnection.mockRejectedValue(new Error('nango down'));

      await expect(
        service.recordConnection(orgId, 7, connectionId),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getConnectionStatus', () => {
    it('returns connected=false when no record exists', async () => {
      await expect(service.getConnectionStatus(orgId)).resolves.toEqual({
        connected: false,
      });
    });

    it('returns connection metadata when a record exists', async () => {
      const connectedAt = new Date('2026-07-09T00:00:00Z');
      repo.findByOrganizationId.mockResolvedValue({
        connectedAt,
        connectedBy: { email: 'a@b.c' },
      });

      await expect(service.getConnectionStatus(orgId)).resolves.toEqual({
        connected: true,
        connectedAt,
        connectedByEmail: 'a@b.c',
      });
    });
  });

  describe('getUsageStats', () => {
    it('throws 404 when no connection is recorded', async () => {
      await expect(service.getUsageStats(orgId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(nango.proxy).not.toHaveBeenCalled();
    });

    it('proxies through Nango with the stored connection id', async () => {
      const stats = {
        api_rate_limit_params: [
          { duration: 'day', calls_made: 1, calls_limit: 600 },
        ],
      };
      repo.findByOrganizationId.mockResolvedValue({
        nangoConnectionId: connectionId,
        connectedBy: { email: 'a@b.c' },
      });
      nango.proxy.mockResolvedValue({ data: stats });

      await expect(service.getUsageStats(orgId)).resolves.toEqual(stats);
      expect(nango.proxy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          endpoint: '/api/v1/usage_stats/api_usage_stats',
          providerConfigKey: 'apollo-oauth',
          connectionId,
          retries: 3,
        }),
      );
    });

    it('maps proxy failures to 502', async () => {
      repo.findByOrganizationId.mockResolvedValue({
        nangoConnectionId: connectionId,
        connectedBy: { email: 'a@b.c' },
      });
      nango.proxy.mockRejectedValue(new Error('upstream 500'));

      await expect(service.getUsageStats(orgId)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('maps empty responses to 502', async () => {
      repo.findByOrganizationId.mockResolvedValue({
        nangoConnectionId: connectionId,
        connectedBy: { email: 'a@b.c' },
      });
      nango.proxy.mockResolvedValue({ data: undefined });

      await expect(service.getUsageStats(orgId)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });
  });

  describe('disconnect', () => {
    it('is a no-op when nothing is recorded', async () => {
      await service.disconnect(orgId);
      expect(nango.deleteConnection).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes the Nango connection and the record', async () => {
      repo.findByOrganizationId.mockResolvedValue({
        nangoConnectionId: connectionId,
        connectedBy: { email: 'a@b.c' },
      });

      await service.disconnect(orgId);
      expect(nango.deleteConnection).toHaveBeenCalledWith(
        'apollo-oauth',
        connectionId,
      );
      expect(repo.delete).toHaveBeenCalledWith(orgId);
    });

    it('skips Nango deletion when no connection id is stored', async () => {
      repo.findByOrganizationId.mockResolvedValue({
        nangoConnectionId: null,
        connectedBy: { email: 'a@b.c' },
      });

      await service.disconnect(orgId);
      expect(nango.deleteConnection).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith(orgId);
    });

    it('still deletes the record when Nango deletion fails', async () => {
      repo.findByOrganizationId.mockResolvedValue({
        nangoConnectionId: connectionId,
        connectedBy: { email: 'a@b.c' },
      });
      nango.deleteConnection.mockRejectedValue(new Error('gone'));

      await service.disconnect(orgId);
      expect(repo.delete).toHaveBeenCalledWith(orgId);
    });
  });

  describe('getAccessToken', () => {
    it('throws 404 when no connection is recorded', async () => {
      await expect(service.getAccessToken(orgId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(nango.getConnection).not.toHaveBeenCalled();
    });

    it('returns the access token from Nango credentials', async () => {
      repo.findByOrganizationId.mockResolvedValue({
        nangoConnectionId: connectionId,
        connectedBy: { email: 'a@b.c' },
      });

      await expect(service.getAccessToken(orgId)).resolves.toBe('tok');
      expect(nango.getConnection).toHaveBeenCalledWith(
        'apollo-oauth',
        connectionId,
      );
    });

    it('throws 404 when Nango has no connection', async () => {
      repo.findByOrganizationId.mockResolvedValue({
        nangoConnectionId: connectionId,
        connectedBy: { email: 'a@b.c' },
      });
      nango.getConnection.mockRejectedValue(new Error('unknown connection'));

      await expect(service.getAccessToken(orgId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 502 when credentials lack an access token', async () => {
      repo.findByOrganizationId.mockResolvedValue({
        nangoConnectionId: connectionId,
        connectedBy: { email: 'a@b.c' },
      });
      nango.getConnection.mockResolvedValue({ credentials: {} });

      await expect(service.getAccessToken(orgId)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });
  });
});
