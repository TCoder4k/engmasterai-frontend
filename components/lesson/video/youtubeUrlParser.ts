// Pure utility: validates and normalizes Lesson.videoUrl (a YouTube
// Unlisted URL, per the corrected video-hosting architecture) into a bare
// video id the IFrame Player API can use. No component, no state — the
// easiest piece of the video stack to unit-test in isolation.
//
// Supported formats: watch?v=, youtu.be/, embed/ — each with extra query
// params tolerated. YouTube Shorts (/shorts/) is deliberately NOT
// recognized: lecture content isn't Shorts-shaped, and silently accepting
// it would be a scope decision made by accident rather than on purpose.
// Anything else (malformed, non-YouTube, e.g. a stray Cloudinary link)
// returns null rather than being passed to the embed as if it might work.

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com']);

export function parseYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return id && VIDEO_ID_RE.test(id) ? id : null;
  }

  if (YOUTUBE_HOSTS.has(host)) {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v');
      return id && VIDEO_ID_RE.test(id) ? id : null;
    }
    if (parsed.pathname.startsWith('/embed/')) {
      const id = parsed.pathname.slice('/embed/'.length).split('/')[0];
      return id && VIDEO_ID_RE.test(id) ? id : null;
    }
    // /shorts/... and anything else on a YouTube host: not a supported
    // lecture-video format, treated the same as an unrecognized URL.
    return null;
  }

  return null;
}
