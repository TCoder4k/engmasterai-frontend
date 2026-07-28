import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { RevealOnScroll, STAGGER_STEP } from '../shared/motion';
import { PRICING_PLANS } from './landingContent';
import { SECTION_IDS } from './sections';

type BillingCycle = 'monthly' | 'yearly';

const formatCurrency = (amount: number): string =>
  amount === 0
    ? '0đ'
    : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// See landingContent.ts: these plans are placeholder pricing. Every button
// goes to /register, the one thing that genuinely happens today.
const Pricing: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');

  return (
    <section
      id={SECTION_IDS.pricing}
      className="scroll-mt-24 py-20 lg:py-28 bg-slate-50/60 dark:bg-ink-950 border-t border-slate-200/80 dark:border-ink-700"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-500/30">
            Bảng giá minh bạch
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-4 mb-4">
            Đầu tư cho tương lai sự nghiệp của bạn
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Chọn gói dịch vụ phù hợp nhất với nhu cầu của bạn. Tất cả các gói trả phí đều đi kèm 14
            ngày cam kết hoàn tiền 100%.
          </p>

          <div
            role="group"
            aria-label="Chu kỳ thanh toán"
            className="mt-8 inline-flex items-center gap-3 p-1.5 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-full shadow-sm"
          >
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              aria-pressed={billingCycle === 'monthly'}
              className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                billingCycle === 'monthly'
                  ? 'bg-slate-900 dark:bg-ink-700 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Thanh toán hàng tháng
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              aria-pressed={billingCycle === 'yearly'}
              className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                billingCycle === 'yearly'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              Thanh toán hàng năm
              <span className="bg-amber-400 text-slate-950 font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full">
                Tiết kiệm 40%
              </span>
            </button>
          </div>
        </div>

        <ul className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {PRICING_PLANS.map((plan, index) => {
            const price = billingCycle === 'yearly' ? plan.yearlyPriceMonthly : plan.monthlyPrice;

            return (
              <RevealOnScroll
                key={plan.id}
                as="li"
                delay={index * STAGGER_STEP}
                className={`rounded-3xl p-8 transition-all duration-300 flex flex-col justify-between relative hover:-translate-y-1.5 ${
                  plan.popular
                    ? 'bg-slate-900 dark:bg-ink-900 text-white border-2 border-blue-500 shadow-2xl lg:scale-105 z-10'
                    : 'bg-white dark:bg-ink-900 text-slate-900 dark:text-white border border-slate-200/90 dark:border-ink-700 shadow-sm hover:shadow-lg'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5 whitespace-nowrap">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    Lựa chọn phổ biến nhất
                  </span>
                )}

                <div>
                  <h3 className="text-2xl font-bold tracking-tight mb-2">{plan.name}</h3>
                  <p
                    className={`text-xs sm:text-sm mb-6 ${
                      plan.popular ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {plan.description}
                  </p>

                  <div
                    className={`mb-6 pb-6 border-b ${
                      plan.popular ? 'border-white/15' : 'border-slate-200 dark:border-ink-700'
                    }`}
                  >
                    <p className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-4xl font-extrabold tracking-tight">
                        {formatCurrency(price)}
                      </span>
                      {price > 0 && (
                        <span
                          className={`text-xs font-semibold ${
                            plan.popular ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          / tháng {billingCycle === 'yearly' ? '(thu theo năm)' : ''}
                        </span>
                      )}
                    </p>
                  </div>

                  <ul className="space-y-3.5 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <span
                          className={`p-1 rounded-full shrink-0 mt-0.5 ${
                            plan.popular
                              ? 'bg-blue-600/40 text-blue-300'
                              : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        </span>
                        <span
                          className={`text-xs sm:text-sm font-medium ${
                            plan.popular ? 'text-slate-200' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={plan.ctaTo}
                  className={`w-full py-3.5 px-6 font-bold rounded-xl transition-all flex items-center justify-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-slate-900 dark:bg-ink-700 hover:bg-slate-800 dark:hover:bg-ink-800 text-white shadow-sm'
                  }`}
                >
                  {plan.ctaText}
                  <ArrowRight
                    className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                    aria-hidden="true"
                  />
                </Link>
              </RevealOnScroll>
            );
          })}
        </ul>

        <p className="mt-12 text-center flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
          Cam kết hoàn tiền 100% trong 14 ngày đầu tiên nếu không hài lòng.
        </p>
      </div>
    </section>
  );
};

export default Pricing;
