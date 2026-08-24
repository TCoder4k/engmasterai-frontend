// Streak Together — Vercel Edge Middleware, the FIRST of its kind in this
// repo (confirmed during the architecture audit: no middleware.ts/Edge
// Functions existed before this).
//
// WHY THIS EXISTS. This app is a pure client-side Vite SPA (vercel.json
// rewrites every path to /index.html, no SSR). A link-preview crawler
// (Facebook/Zalo/Messenger/Discord/etc.) hitting /streak/:shareId would
// otherwise only ever see the one static generic <title> in index.html —
// no custom streak count, no partner names, no image. That defeats the
// whole point of the share feature (approved plan §11: "an important part
// of the feature").
//
// This middleware intercepts requests to /streak/:shareId, and ONLY for
// requests whose User-Agent matches a known crawler, fetches the already-
// PUBLIC `GET /streaks/public/:shareId` endpoint and returns a small
// server-rendered HTML snippet with real Open Graph tags instead. A real
// visitor's browser (any UA not on the list) falls through untouched to
// the normal SPA rewrite — this file changes nothing about what a human
// visitor sees.
//
// Framework-agnostic Vercel Edge Middleware (this app is NOT Next.js, so
// there is no `next/server` import here) — plain Web-standard
// Request/Response, per Vercel's documented API for non-Next.js projects.
//
// NEEDS A REAL SMOKE TEST before this is considered done: curl-ing with a
// fake User-Agent proves the branching logic, but actual crawlers are
// sometimes picky about response shape/caching headers — verify with a
// real bot-preview debugger (e.g. Facebook's Sharing Debugger) against the
// deployed URL, not just locally.

export const config = {
  matcher: '/streak/:shareId',
};

// Case-insensitive substring match against the raw User-Agent header.
// Facebook/Twitter/Slack/Discord/Telegram/WhatsApp/LinkedIn all have
// long-stable, well-documented crawler UA substrings. Zalo's is included
// on a best-effort basis (its exact current crawler UA string was not
// independently verified against a live capture at the time this was
// written) — confirm and adjust this one entry against real traffic logs
// or a live test share before relying on it.
const BOT_USER_AGENT_PATTERNS = [
  'facebookexternalhit',
  'Twitterbot',
  'Slackbot',
  'Discordbot',
  'TelegramBot',
  'WhatsApp',
  'LinkedInBot',
  'Zalo',
];

const isBotRequest = (userAgent: string | null): boolean => {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();
  return BOT_USER_AGENT_PATTERNS.some((pattern) => lower.includes(pattern.toLowerCase()));
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

interface PublicStreakResponse {
  currentStreak: number;
  userA: { name: string };
  userB: { name: string };
}

const buildOgHtml = (shareUrl: string, streak: PublicStreakResponse): string => {
  const title = escapeHtml(
    `🔥 ${streak.currentStreak} ngày — ${streak.userA.name} & ${streak.userB.name} | EngMasterAI`,
  );
  const description = escapeHtml('Cùng nhau duy trì việc học tiếng Anh mỗi ngày với EngMasterAI.');
  const url = escapeHtml(shareUrl);

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="description" content="${description}" />
</head>
<body>
<p>${description}</p>
</body>
</html>`;
};

export default async function middleware(request: Request): Promise<Response | undefined> {
  const userAgent = request.headers.get('user-agent');
  if (!isBotRequest(userAgent)) return undefined; // fall through to the normal SPA rewrite

  const url = new URL(request.url);
  const shareId = url.pathname.split('/').pop();
  if (!shareId) return undefined;

  const apiBaseUrl = process.env.VITE_API_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${apiBaseUrl}/streaks/public/${shareId}`);
    if (!response.ok) return undefined; // unknown share id — let the SPA render its own not-found state
    const streak = (await response.json()) as PublicStreakResponse;
    return new Response(buildOgHtml(url.toString(), streak), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch {
    // Backend unreachable — fall through rather than serving a broken bot
    // response; a real visitor still gets the working SPA either way.
    return undefined;
  }
}
