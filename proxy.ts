import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/lib/i18n';
import { createServerClient } from '@supabase/ssr';
import { siteConfig } from '@/lib/site-config';

// ----- Geo-block -----
// Customer-facing pages are not available from siteConfig.restrictedCountries
// (currently ["KR"] — the wholesale brand operates out of Korea, and the
// Korean retail market is served separately). Vercel sets x-vercel-ip-country
// with the visitor's ISO-3166-1 alpha-2 country code on production.
//
// /manzura/* and /api/admin/* bypass — the admin (in Korea) needs those.
// Local dev has no header so this never blocks during development.
function maybeGeoBlock(req: NextRequest): NextResponse | null {
  const country = req.headers.get('x-vercel-ip-country');
  if (!country) return null;
  const restricted = (siteConfig.restrictedCountries as readonly string[]).map(c => c.toUpperCase());
  if (!restricted.includes(country.toUpperCase())) return null;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Lumée Maison — Not available in your region</title>
  <style>
    body{margin:0;background:#faf6f0;font-family:Georgia,'Times New Roman',serif;color:#3a342c;
      display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px 24px;}
    .card{max-width:560px;text-align:center;background:#fff;border:1px solid #eadfd1;padding:48px 32px;}
    h1{font-style:italic;font-weight:300;font-size:32px;margin:0 0 8px;letter-spacing:1px;}
    .eyebrow{font-size:11px;letter-spacing:3px;color:#9a8e7e;text-transform:uppercase;margin-bottom:18px;}
    p{font-size:15px;line-height:1.6;color:#6b6157;margin:0 0 12px;}
    a{color:#7a5a3a;text-decoration:none;}
  </style>
</head>
<body>
  <div class="card">
    <div class="eyebrow">Lumée Maison</div>
    <h1>Not available in your region</h1>
    <p>Our wholesale service isn't open to your country yet.</p>
    <p>For trade enquiries, please write to <a href="mailto:info@lumeemaison.com">info@lumeemaison.com</a>.</p>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: 451,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: false,
});

// Refresh the Supabase auth session cookies on every public request so server
// components observe a stable, non-expired session. Returns the response with
// any refreshed Set-Cookie headers attached.
async function withSupabaseSession(req: NextRequest, baseResponse: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return baseResponse;

  let response = baseResponse;
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touching getUser() triggers a refresh if the access token is near expiry.
  await supabase.auth.getUser();
  return response;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // All /api/ routes bypass i18n entirely
  if (pathname.startsWith('/api/')) {
    // Protect admin API (except auth and logout)
    if (
      pathname.startsWith('/api/admin/') &&
      !pathname.startsWith('/api/admin/auth') &&
      !pathname.startsWith('/api/admin/logout')
    ) {
      const res = NextResponse.next();
      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      if (!session.loggedIn) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return res;
    }
    return NextResponse.next();
  }

  // Admin page protection — all /manzura paths bypass i18n
  if (pathname.startsWith('/manzura')) {
    if (pathname !== '/manzura/login') {
      const res = NextResponse.next();
      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      if (!session.loggedIn) {
        return NextResponse.redirect(new URL('/manzura/login', req.url));
      }
      return res;
    }
    // Login page: pass through directly without i18n redirect
    return NextResponse.next();
  }

  // Geo-block customer-facing routes for visitors in restrictedCountries.
  // Reached only after the /manzura and /api/admin branches above have
  // already returned, so the admin paths are not affected.
  const blocked = maybeGeoBlock(req);
  if (blocked) return blocked;

  // Legacy /ko/* URLs → redirect to /en/* (Korean locale removed)
  if (pathname === '/ko' || pathname.startsWith('/ko/')) {
    return withSupabaseSession(
      req,
      NextResponse.redirect(new URL('/en' + (pathname.replace(/^\/ko/, '') || '/'), req.url), 308),
    );
  }

  // i18n routing + Supabase session refresh for all other pages
  const response = intlMiddleware(req);
  return withSupabaseSession(req, response);
}

export const config = {
  matcher: [
    '/manzura/:path*',
    '/api/admin/:path*',
    '/((?!_next|_vercel|api|.*\\..*).*)',
  ],
};
