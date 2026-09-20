import { describe, it, expect } from 'vitest';
import {
  isTopLevelNavigation,
  redirectTargetFromBody,
  rewriteCookieForProxy,
} from '@/lib/auth-proxy';

const request = (method: string, headers: Record<string, string>) => ({
  method,
  headers: new Headers(headers),
});

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });

describe('isTopLevelNavigation', () => {
  it('recognises a document navigation', () => {
    expect(
      isTopLevelNavigation(
        request('GET', {
          'sec-fetch-mode': 'navigate',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }),
      ),
    ).toBe(true);
  });

  it('leaves an XHR alone, which handles its own redirect', () => {
    expect(
      isTopLevelNavigation(
        request('GET', { 'sec-fetch-mode': 'cors', accept: '*/*' }),
      ),
    ).toBe(false);
  });

  it('never treats a POST as a navigation', () => {
    expect(
      isTopLevelNavigation(request('POST', { 'sec-fetch-mode': 'navigate' })),
    ).toBe(false);
  });

  it('falls back to Accept when sec-fetch-mode is absent', () => {
    expect(isTopLevelNavigation(request('GET', { accept: 'text/html' }))).toBe(
      true,
    );
    expect(
      isTopLevelNavigation(request('GET', { accept: 'application/json' })),
    ).toBe(false);
  });
});

describe('redirectTargetFromBody', () => {
  it("picks up oauth-provider's JSON redirect", async () => {
    await expect(
      redirectTargetFromBody(
        jsonResponse({
          redirect: true,
          url: 'http://localhost:9876/callback?code=abc',
        }),
      ),
    ).resolves.toBe('http://localhost:9876/callback?code=abc');
  });

  it('ignores a sign-in response that carries no redirect', async () => {
    await expect(
      redirectTargetFromBody(
        jsonResponse({ redirect: false, token: 't', user: {} }),
      ),
    ).resolves.toBeNull();
  });

  it('ignores an ordinary payload', async () => {
    await expect(
      redirectTargetFromBody(jsonResponse({ session: { id: 1 } })),
    ).resolves.toBeNull();
  });

  it('ignores a non-JSON body', async () => {
    await expect(
      redirectTargetFromBody(
        new Response('hi', { headers: { 'content-type': 'text/html' } }),
      ),
    ).resolves.toBeNull();
  });

  it('leaves the body readable for the pass-through path', async () => {
    const response = jsonResponse({ redirect: false, token: 'abc' });
    await redirectTargetFromBody(response);
    await expect(response.text()).resolves.toBe(
      JSON.stringify({ redirect: false, token: 'abc' }),
    );
  });
});

describe('rewriteCookieForProxy', () => {
  it('drops Domain so the cookie lands on this origin', () => {
    expect(
      rewriteCookieForProxy(
        'session=abc; Path=/; Domain=.example.com; HttpOnly; Secure',
      ),
    ).toBe('session=abc; Path=/; HttpOnly; Secure');
  });

  it('relaxes SameSite=None now that it is same-site', () => {
    expect(rewriteCookieForProxy('session=abc; SameSite=None; Secure')).toBe(
      'session=abc; SameSite=Lax; Secure',
    );
  });
});
