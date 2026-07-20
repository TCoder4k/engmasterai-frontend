import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';

interface VideoResumePromptProps {
  onWatchAgain: () => void;
  onDismiss: () => void;
}

// Shown only when a saved position is within ~5s/~97% of the real
// duration (design doc §7.4.3) — offers a choice instead of silently
// re-seeking into a near-complete tail, which would otherwise immediately
// re-trigger the ENDED state and read as broken.
const VideoResumePrompt: React.FC<VideoResumePromptProps> = ({ onWatchAgain, onDismiss }) => {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-x-0 bottom-0 bg-slate-950/90 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-slate-200">{t.lesson.videoWatchAgainPrompt}</p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-bold text-slate-400 hover:text-slate-200 px-2 py-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {t.lesson.videoResumeDismiss}
        </button>
        <button
          type="button"
          onClick={onWatchAgain}
          className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          {t.lesson.videoWatchAgain}
        </button>
      </div>
    </div>
  );
};

export default VideoResumePrompt;
