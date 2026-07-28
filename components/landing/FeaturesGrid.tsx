import React from 'react';
import {
  ArrowUpRight,
  Mic,
  MessageSquareText,
  RotateCcw,
  Smartphone,
  Sparkles,
  Target,
} from 'lucide-react';
import { RevealOnScroll, STAGGER_STEP } from '../shared/motion';
import { FEATURES, FeatureItem } from './landingContent';
import { SECTION_IDS } from './sections';

const ICONS: Record<FeatureItem['iconName'], React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> =
  {
    Mic,
    RotateCcw,
    MessageSquareText,
    Sparkles,
    Target,
    Smartphone,
  };

const FeaturesGrid: React.FC = () => {
  return (
    <section
      id={SECTION_IDS.features}
      className="scroll-mt-24 py-20 lg:py-28 bg-slate-50/50 dark:bg-ink-950 border-t border-slate-200/80 dark:border-ink-700"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-500/30">
            Tính năng vượt trội
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-4 mb-4">
            Đột phá trải nghiệm học tiếng Anh bằng AI
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Kết hợp công nghệ trí tuệ nhân tạo hiện đại nhất với khoa học tư duy nhận thức để tối ưu
            hóa thời gian và hiệu quả phản xạ của bạn.
          </p>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, index) => {
            const Icon = ICONS[feature.iconName];

            return (
              <RevealOnScroll
                key={feature.id}
                as="li"
                delay={(index % 3) * STAGGER_STEP}
                className="bg-white dark:bg-ink-900 p-8 rounded-3xl border border-slate-200/80 dark:border-ink-700 shadow-sm hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-500/50 hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <span className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-300">
                      <Icon className="w-6 h-6" aria-hidden={true} />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-ink-800 px-2.5 py-1 rounded-md">
                      {feature.tag}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <p className="mt-8 pt-4 border-t border-slate-100 dark:border-ink-700 flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Khám phá công nghệ
                  <ArrowUpRight
                    className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                    aria-hidden="true"
                  />
                </p>
              </RevealOnScroll>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default FeaturesGrid;
