import axios from 'axios';

/** What a browser asks before calling the API from the app's origin. */
const APP_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:4200';
const preflight = (path: string, method: string, origin: string) =>
  axios.options(path, {
    headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'content-type' },
    validateStatus: () => true,
  });

describe('CORS', () => {
  it.each(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])('lets the app call the API with %s, with its cookie', async (method) => {
    for (const path of ['/api/v1/objects/contact/records/1', '/auth/organization/create']) {
      const res = await preflight(path, method, APP_ORIGIN);
      expect(res.status).toBeLessThan(300);
      expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-methods']).toContain(method);
    }
  });

  it('does not extend that to other origins', async () => {
    const res = await preflight('/api/v1/objects/contact/records/1', 'PATCH', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
