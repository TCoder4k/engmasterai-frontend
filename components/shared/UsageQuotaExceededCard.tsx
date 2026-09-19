import React from 'react';
import { AlertTriangle, Crown, Mic, Search, Sparkles } from 'lucide-react';
import { UsageKind } from '../../services/usageService';

// 2026-09-16 pricing relaunch (Phase B) — the polished "you're out of free
// AI usage" response, replacing the small inline nudges each surface used
// to roll on its own. One shared component so Dictionary/Chat/Shadowing/
// Speaking all present the SAME reaction to the SAME kind of denial,
// switching only on which quota kind was actually exhausted (`kind`) and
// the exact used/limit the rejected request carried back
// (UsageQuotaExceededException's own body — see ApiError.details).
//
// `isPro` is derived by the caller from FREE_LIMIT below, not trusted from
// anywhere else — a PRO user CAN still hit their own (much higher) ceiling,
// and that case must never show an "upgrade to PRO" pitch to someone who
// already paid for PRO.

const FREE_LIMIT: Record<UsageKind, number> = { aiQuery: 20, aiGrading: 2, speaking: 3 };
const PRO_PERIOD_LABEL: Record<UsageKind, string> = {
  aiQuery: 'tháng này',
  aiGrading: 'tháng này',
  speaking: 'hôm nay',
};

const KIND_META: Record<
  UsageKind,
  { Icon: typeof Mic; title: string; progressLabel: string }
> = {
  aiQuery: {
    Icon: Search,
    title: 'Bạn đã dùng hết lượt tra cứu AI miễn phí',
    progressLabel: 'Lượt tra cứu AI miễn phí',
  },
  aiGrading: {
    Icon: Sparkles,
    title: 'Bạn đã dùng hết lượt chấm bài AI miễn phí',
    progressLabel: 'Lượt chấm bài AI miễn phí',
  },
  speaking: {
    Icon: Mic,
    title: 'Bạn đã dùng hết lượt luyện nói miễn phí',
    progressLabel: 'Lượt luyện nói AI miễn phí',
  },
};

interface UsageQuotaExceededCardProps {
  kind: UsageKind;
  used: number;
  limit: number;
  onUpgrade: () => void;
  /** Only pass this where "back" is a meaningful, distinct action (a full-page context) — an embedded panel already has its own close/dismiss control. */
  onBack?: { label: string; onClick: () => void };
}

const UsageQuotaExceededCard: React.FC<UsageQuotaExceededCardProps> = ({
  kind,
  used,
  limit,
  onUpgrade,
  onBack,
}) => {
  const { Icon, title, progressLabel } = KIND_META[kind];
  const isPro = limit > FREE_LIMIT[kind];
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-3xl shadow-lg p-5 sm:p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle size={26} className="text-rose-500" aria-hidden="true" />
      </div>

      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
        {title}
      </h2>
      <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        {isPro
          ? `Bạn đã dùng ${used}/${limit} lượt trong ${PRO_PERIOD_LABEL[kind]}. Giới hạn sẽ được làm mới ở kỳ tiếp theo.`
          : `Bạn đã dùng ${used}/${limit} lượt miễn phí trong ${PRO_PERIOD_LABEL[kind]}. Nâng cấp PRO để có giới hạn cao hơn nhiều.`}
      </p>

      <div className="mt-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-3.5">
        <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300">
          <span className="inline-flex items-center gap-1.5">
            <Icon size={14} aria-hidden="true" />
            {progressLabel}
          </span>
          <span>
            {used}/{limit}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-rose-200/70 dark:bg-rose-500/20 overflow-hidden">
          <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {!isPro && (
        <div className="mt-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3.5 text-left">
          <p className="flex items-center gap-1.5 text-xs font-black text-blue-700 dark:text-blue-300">
            <Crown size={14} aria-hidden="true" />
            Nâng cấp lên PRO để mở khóa nhiều lợi ích hơn
          </p>
          <ul className="mt-1.5 space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <li>• 300 lượt tra cứu AI/tháng</li>
            <li>• 30 lượt chấm bài AI/tháng & 30 lượt luyện nói/ngày</li>
            <li>• Lưu từ vựng không giới hạn</li>
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {!isPro && (
          <button
            type="button"
            onClick={onUpgrade}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 transition-opacity"
          >
            <Crown size={15} aria-hidden="true" />
            Mở PRO 30 ngày · 19.000đ
          </button>
        )}
        {onBack && (
          <button
            type="button"
            onClick={onBack.onClick}
            className="w-full text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-1.5"
          >
            ← {onBack.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default UsageQuotaExceededCard;
