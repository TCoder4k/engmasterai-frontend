// Loads the YouTube IFrame Player API script exactly once and resolves
// with the global `YT` namespace once it's ready. Hand-rolled rather than
// a dependency like `react-youtube` — no new npm package for a single
// script-load + callback (a deliberate, small dependency decision, not an
// oversight; revisit if the video stack grows more complex).

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<any> | null = null;

export function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube IFrame API requires a browser environment'));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT);
    };

    const existingScript = document.getElementById('youtube-iframe-api');
    if (existingScript) return;

    const script = document.createElement('script');
    script.id = 'youtube-iframe-api';
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('Failed to load the YouTube player script'));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}
