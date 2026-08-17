import React from 'react';

type LogoSize = 'sm' | 'md' | 'lg';
type LogoVariant = 'default' | 'inverted';

interface LogoProps {
  size?: LogoSize;
  /** Shows the official tagline under the wordmark. */
  withTagline?: boolean;
  /** 'inverted' = white wordmark for permanently dark/colored surfaces (footer, hero panels) — independent of the app's light/dark toggle. */
  variant?: LogoVariant;
  className?: string;
  /** Extra content rendered under the wordmark, e.g. a portal badge — takes the tagline's slot instead of it. */
  children?: React.ReactNode;
}

// icon-to-wordmark gap stays in the 12-16px range across sizes so the two
// read as one connected block rather than two loose elements.
const SIZE_STYLES: Record<LogoSize, { icon: string; gap: string; word: string; tagline: string }> = {
  sm: { icon: 'w-7 h-7', gap: 'gap-2', word: 'text-base', tagline: 'text-[9px]' },
  md: { icon: 'w-10 h-10', gap: 'gap-3', word: 'text-xl', tagline: 'text-[10px]' },
  lg: { icon: 'w-[72px] h-[72px]', gap: 'gap-4', word: 'text-3xl', tagline: 'text-xs' },
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  withTagline = false,
  variant = 'default',
  className = '',
  children,
}) => {
  const s = SIZE_STYLES[size];
  const wordColor = variant === 'inverted' ? 'text-white' : 'text-slate-900 dark:text-white';
  const aiColor = variant === 'inverted' ? 'text-blue-200' : 'text-blue-600 dark:text-blue-400';
  const taglineColor = variant === 'inverted' ? 'text-blue-100/70' : 'text-slate-500 dark:text-slate-400';

  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      {/* Decorative — the wordmark right beside it already names the brand. */}
      <img
        src="/logo/logo.png"
        alt=""
        aria-hidden="true"
        className={`${s.icon} object-contain shrink-0 transition-transform group-hover:scale-105`}
      />
      <span className="flex flex-col leading-none">
        <span className={`${s.word} font-extrabold tracking-tight ${wordColor}`}>
          EngMaster<span className={aiColor}>AI</span>
        </span>
        {withTagline && (
          <span className={`${s.tagline} font-semibold tracking-wide mt-1 ${taglineColor}`}>
            Learn Smarter, Master English
          </span>
        )}
        {children}
      </span>
    </span>
  );
};

export default Logo;
