// Minimal ambient typing for the Cloudflare Turnstile global — covers only
// what services/turnstileWidget.ts actually calls. No @types package exists
// for this; hand-rolled to match this frontend's minimal-dependency
// convention, same as types/google-identity.d.ts.
export interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: TurnstileRenderOptions,
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}
