import React from 'react';
import { VideoOff } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';

interface VideoUnavailableStateProps {
  onRetry?: () => void;
}

// One shared honest-failure surface for every video failure reason
// (malformed/non-YouTube URL, deleted, private, embedding-disabled,
// age/region-restricted, IFrame API failure, third-party cookie/embed
// restriction) — the student-facing message and retry action are the same
// regardless of which third-party cause produced it (design doc §7.7).
const VideoUnavailableState: React.FC<VideoUnavailableStateProps> = ({ onRetry }) => {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
      <VideoOff size={32} className="text-slate-500 mb-3" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-300 mb-3">{t.lesson.videoUnavailable}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-bold text-indigo-400 hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg px-3 py-1.5"
        >
          {t.common.tryAgain}
        </button>
      )}
    </div>
  );
};

export default VideoUnavailableState;
