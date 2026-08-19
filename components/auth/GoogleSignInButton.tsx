import React, { useEffect, useRef, useState } from 'react';
import {
  GoogleSignInUnavailableError,
  renderGoogleButton,
  setGoogleCredentialHandler,
} from '../../services/googleAuth';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
// GIS's own documented maximum for a rendered button's width.
const GIS_MAX_WIDTH = 400;
const RESIZE_DEBOUNCE_MS = 200;

interface GoogleSignInButtonProps {
  /** 'continue_with' on the login form, 'signup_with' on the register form
   * — the only visible difference between the two forms' buttons. */
  text: 'continue_with' | 'signup_with';
  onCredential: (credential: string) => void;
}

/**
 * Renders the OFFICIAL Google-controlled Sign-In button via
 * google.accounts.id.renderButton() into a container this component owns.
 * Replaces the old static Tailwind button block entirely (Sprint 02A) —
 * including the "Hoặc" divider above it, so when Google sign-in is
 * unconfigured (no VITE_GOOGLE_CLIENT_ID) this component renders nothing at
 * all and the form shows no dangling separator.
 */
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  text,
  onCredential,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Always the latest onCredential, read through a ref rather than as an
  // effect dependency — otherwise every parent re-render (e.g. typing in
  // the email field) would recreate the callback prop and re-run the whole
  // GIS render/observer setup below.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  const [unavailable, setUnavailable] = useState(false);
  // The width GIS was last asked to render at. renderGoogleButton() injects
  // an iframe that self-resizes ASYNCHRONOUSLY once Google's server responds
  // (its HEIGHT, driven by shape/size/text — never something this component
  // requests) — a mutation of `container`'s own children, which the
  // ResizeObserver below also watches. Reacting to every observed size
  // change unconditionally therefore re-triggers render(), which wipes and
  // re-renders the iframe, which resizes again: an unbounded
  // render -> resize -> render loop hitting accounts.google.com on every
  // iteration (Phase 11 production incident). Width is the only dimension
  // this component ever passes to GIS as a render option and is bounded by
  // the flex/w-full parent, not by iframe content — so a GIS-driven resize
  // never changes it. Gating re-render on width actually changing breaks
  // the feedback loop while still reacting to a real viewport/layout resize.
  const lastRenderedWidthRef = useRef<number | null>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;
    setGoogleCredentialHandler((credential) =>
      onCredentialRef.current(credential),
    );

    const render = async () => {
      const container = containerRef.current;
      if (!container) return;
      try {
        const measuredWidth = container.clientWidth || GIS_MAX_WIDTH;
        lastRenderedWidthRef.current = measuredWidth;
        await renderGoogleButton(container, CLIENT_ID, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'pill',
          width: Math.min(measuredWidth, GIS_MAX_WIDTH),
          locale: 'vi',
        });
        if (!cancelled) setUnavailable(false);
      } catch (err) {
        if (!cancelled && err instanceof GoogleSignInUnavailableError) {
          setUnavailable(true);
        }
      }
    };

    void render();

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const container = containerRef.current;
    const resizeObserver =
      container && 'ResizeObserver' in window
        ? new ResizeObserver(() => {
            const currentWidth = containerRef.current?.clientWidth ?? null;
            if (
              currentWidth === null ||
              currentWidth === lastRenderedWidthRef.current
            ) {
              return;
            }
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => void render(), RESIZE_DEBOUNCE_MS);
          })
        : null;
    resizeObserver?.observe(container!);

    return () => {
      cancelled = true;
      setGoogleCredentialHandler(null);
      resizeObserver?.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCredential is read via onCredentialRef, deliberately not a dependency
  }, [text]);

  if (!CLIENT_ID) return null;

  return (
    <>
      <div className="relative my-10">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t-2 border-slate-100"></span>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-slate-50 text-slate-500 font-bold uppercase tracking-widest">
            Hoặc
          </span>
        </div>
      </div>

      {unavailable ? (
        <p className="text-center text-slate-400 text-sm font-medium py-2">
          Đăng nhập Google hiện không khả dụng. Vui lòng dùng email/mật khẩu.
        </p>
      ) : (
        <>
          <div
            ref={containerRef}
            data-testid="google-signin-container"
            className="w-full flex justify-center min-h-[52px]"
          />
          {/* Phase 11.1: GIS exposes no official callback for a blocked
              popup on the button flow (only PromptMomentNotification, which
              covers One Tap prompt() only) — there is no reliable signal to
              detect this and show the tip conditionally, so it is shown
              unconditionally instead. */}
          <p
            data-testid="google-signin-popup-tip"
            className="text-center text-slate-400 text-xs mt-2"
          >
            Nút không phản hồi? Trình duyệt có thể đang chặn cửa sổ đăng nhập
            Google — hãy cho phép pop-up cho trang này rồi thử lại.
          </p>
        </>
      )}
    </>
  );
};
