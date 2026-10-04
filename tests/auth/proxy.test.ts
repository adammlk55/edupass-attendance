// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import nextConfig from '../../next.config';

const mock = vi.hoisted(() => ({ create: vi.fn(), claims: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mock.create }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  mock.create.mockReturnValue({ auth: { getClaims: mock.claims } });
  mock.claims.mockResolvedValue({ data: null, error: null });
});
afterEach(() => vi.unstubAllEnvs());

it('redirects unauthenticated dashboard requests to a clean login URL', async () => {
  const response = await proxy(new NextRequest('http://localhost:3000/dashboard?tab=overview'));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  expect(response.headers.get('cache-control')).toContain('no-store');
});

it('allows verified sessions and refreshes cookies on request and response', async () => {
  mock.create.mockImplementation((_url, _key, options) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll(
          [
            {
              name: 'sb-test-auth-token',
              value: 'refreshed',
              options: { path: '/', sameSite: 'lax' },
            },
          ],
          { Pragma: 'no-cache', Expires: '0' },
        );
        return { data: { claims: { sub: 'test-user' } }, error: null };
      },
    },
  }));
  const request = new NextRequest('http://127.0.0.1:3000/dashboard');
  const response = await proxy(request);
  expect(response.status).toBe(200);
  expect(request.cookies.get('sb-test-auth-token')?.value).toBe('refreshed');
  expect(response.cookies.get('sb-test-auth-token')?.value).toBe('refreshed');
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(response.headers.get('expires')).toBe('0');
});

it('preserves cleared/refreshed cookies and cache headers when redirecting', async () => {
  mock.create.mockImplementation((_url, _key, options) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll(
          [{ name: 'sb-test-auth-token', value: '', options: { maxAge: 0, path: '/' } }],
          { Pragma: 'no-cache', Expires: '0' },
        );
        return { data: null, error: { message: 'Session expired' } };
      },
    },
  }));
  const response = await proxy(new NextRequest('http://localhost:3000/dashboard'));
  expect(response.status).toBe(307);
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  expect(response.headers.get('pragma')).toBe('no-cache');
});

it('strips old credential query parameters without reflecting values', async () => {
  const response = await proxy(
    new NextRequest(
      'http://localhost:3000/login?email=fake%40example.invalid&password=test-fixture',
    ),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(mock.create).not.toHaveBeenCalled();
});

it('keeps the login public and leaves JSON API auth checks to their handlers', async () => {
  expect((await proxy(new NextRequest('http://localhost:3000/login'))).status).toBe(200);
  expect((await proxy(new NextRequest('http://localhost:3000/api/admin/data'))).status).toBe(200);
});

it('allows only the two requested local development hostnames', () => {
  expect(nextConfig.allowedDevOrigins).toEqual(['localhost', '127.0.0.1']);
});
