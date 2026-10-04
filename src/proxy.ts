import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  // Remove legacy unsafe query strings without reading or reflecting their values.
  if (
    request.nextUrl.pathname === '/login' &&
    (request.nextUrl.searchParams.has('email') || request.nextUrl.searchParams.has('password'))
  ) {
    const clean = NextResponse.redirect(new URL('/login', request.url), 303);
    clean.headers.set('Cache-Control', 'private, no-store');
    clean.headers.set('Referrer-Policy', 'no-referrer');
    return clean;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return response;
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items, headers) {
          const previousCookies = response.cookies.getAll();
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          previousCookies.forEach((cookie) => response.cookies.set(cookie));
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );
  const { data, error } = await client.auth.getClaims();
  response.headers.set('Cache-Control', 'private, no-store');
  const isPublicPage = request.nextUrl.pathname === '/login';
  const isApi = request.nextUrl.pathname.startsWith('/api/');
  // API handlers return JSON auth errors. School roles are checked in requireStaff().
  if ((!data?.claims || error) && !isPublicPage && !isApi) {
    const redirect = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    for (const header of ['Cache-Control', 'Expires', 'Pragma']) {
      const value = response.headers.get(header);
      if (value) redirect.headers.set(header, value);
    }
    return redirect;
  }
  return response;
}
export const config = {
  matcher: ['/((?!api/device|api/cron|_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
};
