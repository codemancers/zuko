import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNeedsAttention } from '@/lib/api/sales-overview';
import { apiClient } from '@/lib/api-client';

afterEach(() => {
  vi.restoreAllMocks();
  apiClient.setOrganizationId(null);
});
describe('Needs attention request contract', () => {
  it('pins the request org, date, page and cancellation signal independently of mutable client state', async () => {
    apiClient.setOrganizationId(99);
    const body = {
      tasks: [],
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    const controller = new AbortController();
    expect(
      await getNeedsAttention(7, '2026-11-05', 2, controller.signal),
    ).toEqual(body);
    expect(fetcher).toHaveBeenCalledWith(
      '/api/proxy/api/sales-overview/needs-attention?date=2026-11-05&page=2&limit=10',
      {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'x-organization-id': '7' },
      },
    );
  });
  it.each([401, 403, 500])(
    'does not disguise HTTP %s as an empty task list',
    async (status) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('{}', { status }),
      );
      await expect(getNeedsAttention(7, '2026-11-05', 1)).rejects.toMatchObject(
        { status },
      );
    },
  );
});
