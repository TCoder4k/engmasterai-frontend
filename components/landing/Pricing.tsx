import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Check, Crown, Flame, ShieldCheck, Zap } from 'lucide-react';
import { RevealOnScroll, STAGGER_STEP } from '../shared/motion';
import { PRICING_PLANS } from './landingContent';
import { SECTION_IDS } from './sections';

const Pricing: React.FC = () => {
  return (
    <section
      id={SECTION_IDS.pricing}
      className="scroll-mt-24 py-20 lg:py-28 bg-slate-50/60 dark:bg-ink-950 border-t border-slate-200/80 dark:border-ink-700"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-500/30">
            Bảng giá minh bạch
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight mt-4 mb-4">
            Đầu tư cho tương lai sự nghiệp của bạn
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Chọn gói dịch vụ phù hợp nhất với nhu cầu của bạn. Tất cả các gói trả phí đều đi kèm 14
            ngày cam kết hoàn tiền 100%.
          </p>
        </div>

        <ul className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {PRICING_PLANS.map((plan, index) => {
            const isPremium = plan.id === 'learning';
            const isPro = plan.id === 'pro';

            return (
              <RevealOnScroll
                key={plan.id}
                as="li"
                delay={index * STAGGER_STEP}
                className={`relative flex flex-col rounded-3xl bg-white p-6 sm:p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl dark:bg-slate-900 ${
                  isPremium
                    ? 'border-2 border-amber-300 dark:border-amber-500/50 ring-4 ring-amber-100/50 dark:ring-amber-500/10 lg:scale-105 z-10'
                    : isPro
                    ? 'border-2 border-blue-200 dark:border-blue-500/40'
                    : 'border border-slate-200 dark:border-slate-800'
                }`}
              >
                {isPremium && (
                  <span className="absolute -top-3.5 right-6 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-md">
                    <Crown size={12} aria-hidden="true" />
                    Đề xuất
                  </span>
                )}
                {plan.badge && !isPremium && (
                  <span className="absolute right-6 top-6 inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                    <Calendar size={12} aria-hidden="true" />
                    {plan.badge}
                  </span>
                )}
                {plan.badge && isPremium && (
                  <span className="absolute right-6 top-6 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm">
                    <Calendar size={12} aria-hidden="true" />
                    {plan.badge}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isPremium ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'}`}>
                    {isPremium ? <Crown size={22} /> : <Zap size={22} />}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">{plan.name}</h3>
                </div>

                <div className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    {plan.price}
                  </span>
                  {plan.suffix && <span className="text-xs font-bold text-slate-500">{plan.suffix}</span>}
                  {plan.compareAt && (
                    <span className="text-sm font-bold text-slate-400 line-through">
                      {plan.compareAt}
                    </span>
                  )}
                  {plan.discount && isPremium && (
                    <span className="mt-3 flex basis-full items-center gap-1.5 rounded-xl bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                      <Flame size={14} className="text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                      {plan.discount}
                    </span>
                  )}
                </div>

                <p className="mt-3 min-h-12 text-xs sm:text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{plan.description}</p>

                <ul className="mt-6 flex-1 space-y-3.5 border-t border-slate-100 pt-6 text-xs sm:text-sm font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 items-start">
                      <Check size={16} className={`shrink-0 mt-0.5 ${isPremium ? 'text-amber-500' : 'text-emerald-500'}`} aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={plan.ctaTo}
                  className={`mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-black transition-all shadow-md focus:outline-none focus-visible:ring-2 ${
                    plan.id === 'starter'
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      : isPremium
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 shadow-amber-500/20 hover:from-amber-300 hover:to-orange-400 focus-visible:ring-amber-400'
                      : 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-500 focus-visible:ring-blue-400'
                  }`}
                >
                  {isPremium && <ShieldCheck size={16} aria-hidden="true" />}
                  {plan.ctaText}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </RevealOnScroll>
            );
          })}
        </ul>

        <p className="mt-14 text-center flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
          Cam kết hoàn tiền 100% trong 14 ngày đầu tiên nếu không hài lòng.
        </p>
      </div>
    </section>
  );
};

export default Pricing;
