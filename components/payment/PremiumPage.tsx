import React from 'react';
import { ArrowRight, Calendar, Check, Crown, Flame, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import BackButton from '../shared/BackButton';
import { useTranslation } from '../../i18n/useTranslation';
import { authService } from '../../services/authService';

const PremiumPage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const vi = language === 'vi';
  const user = authService.getUser();
  const activePlan = user?.isPremium ? 'PREMIUM_MONTHLY' : user?.isPro ? 'PRO_MONTHLY' : null;
  const planButton = (plan: 'PRO_MONTHLY' | 'PREMIUM_MONTHLY', upgrade: string) =>
    activePlan === plan ? (vi ? 'Gia hạn gói' : 'Renew plan') : upgrade;

  const plans = [
    {
      name: vi ? 'Gói Free' : 'Free',
      price: vi ? 'Miễn phí' : 'Free',
      description: vi ? 'Trải nghiệm các tính năng cơ bản' : 'Try the core learning experience',
      features: vi
        ? ['Học 3 bài đầu mỗi khóa', 'Truy cập bài luyện cơ bản', 'Theo dõi tiến độ học tập']
        : ['First 3 lessons in each course', 'Core practice activities', 'Learning progress tracking'],
      tone: 'border-slate-200 dark:border-slate-700',
      disabled: true,
    },
    {
      name: 'Gói Pro',
      price: '19.000đ',
      compareAt: '59.000đ',
      discount: vi ? 'Giảm 68%' : 'Save 68%',
      suffix: vi ? '/ 30 ngày' : '/ 30 days',
      description: vi ? 'Nhiều quyền lợi hơn cho việc học hằng ngày' : 'More value for daily learning',
      features: vi
        ? [
            'Lưu từ vựng không giới hạn (tối đa 50 từ ở gói Free)',
            '300 lượt tra cứu AI & trợ lý Engy / tháng',
            '30 lượt AI chấm phát âm chuyên sâu / tháng',
            '30 lượt luyện nói giao tiếp cùng AI / ngày',
          ]
        : [
            'Unlimited personal vocabulary',
            '300 AI lookups & Engy assistant / month',
            '30 deep pronunciation AI checks / month',
            '30 AI speaking partner sessions / day',
          ],
      tone: 'border-blue-200 dark:border-blue-500/40',
      badge: vi ? '30 NGÀY' : '30 DAYS',
      button: planButton('PRO_MONTHLY', vi ? 'Nâng cấp Pro' : 'Upgrade to Pro'),
      onClick: () => navigate('/checkout'),
    },
    {
      name: vi ? 'Gói Học Tập' : 'Learning Plan',
      price: '119.000đ',
      compareAt: '299.000đ',
      discount: vi ? 'Mở khóa trọn bộ 365 ngày – Tiết kiệm nhất cho học tập dài hạn' : 'Unlock all 365 days – Best value for long-term study',
      suffix: vi ? '/ 1 năm' : '/ 1 year',
      description: vi ? 'Mở khóa toàn bộ nội dung & tính năng cao cấp' : 'Unlock all content & advanced features',
      features: vi
        ? [
            'Mở khóa toàn bộ khóa học, bài học & Thư viện từ vựng TOEIC 600',
            'Tra cứu từ điển và trợ lý AI giới hạn',
            'Ưu tiên hỗ trợ VIP & tính năng cao cấp nhất',
          ]
        : [
            'Unlock all courses, lessons & TOEIC 600 vocabulary library',
            'Limited dictionary lookup & AI assistant',
            'VIP priority support & advanced features',
          ],
      tone: 'border-amber-300 dark:border-amber-500/50 ring-2 ring-amber-100 dark:ring-amber-500/10',
      badge: vi ? '1 NĂM' : '1 YEAR',
      button: planButton('PREMIUM_MONTHLY', vi ? 'Mở khóa Gói Học Tập' : 'Unlock Learning Plan'),
      onClick: () => navigate('/checkout?plan=PREMIUM_MONTHLY'),
      premium: true,
    },
  ];

  return (
    <StudentLayout>
      <div className="mx-auto max-w-6xl">
        <BackButton to="/home" label={vi ? 'Quay lại' : 'Back'} className="mb-4" />
        <section className="relative min-h-[150px] overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-100/70 px-6 py-6 shadow-sm dark:border-blue-900/60 dark:from-blue-950/50 dark:via-slate-900 dark:to-blue-900/30 sm:px-8 sm:py-7">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-extrabold text-blue-700 shadow-sm dark:bg-slate-800/80 dark:text-blue-300">
              <Sparkles size={14} aria-hidden="true" />
              {vi ? 'Học tập không giới hạn' : 'Learn without limits'}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {vi ? 'Nâng cấp tài khoản' : 'Upgrade your account'}
            </h1>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
              {vi
                ? 'Chọn gói phù hợp để mở khóa thêm nội dung và học tập hiệu quả hơn mỗi ngày.'
                : 'Choose the plan that fits your goals and keep learning every day.'}
            </p>
          </div>
          <Crown className="absolute right-8 top-1/2 h-32 w-32 -translate-y-1/2 rotate-6 text-blue-300/55 dark:text-blue-500/25 sm:right-16" aria-hidden="true" />
        </section>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:bg-slate-900 sm:p-6 ${plan.tone}`}>
              {plan.premium && (
                <span className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm">
                  <Crown size={12} aria-hidden="true" />
                  {vi ? 'Đề xuất' : 'Recommended'}
                </span>
              )}
              {plan.badge && !plan.premium && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                  <Calendar size={12} aria-hidden="true" />
                  {plan.badge}
                </span>
              )}
              {plan.badge && plan.premium && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm">
                  <Calendar size={12} aria-hidden="true" />
                  {plan.badge}
                </span>
              )}
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${plan.premium ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'}`}>
                  {plan.premium ? <Crown size={20} /> : <Zap size={20} />}
                </span>
                <h2 className="font-black text-slate-900 dark:text-white">{plan.name}</h2>
              </div>
              <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {plan.price}
                </span>
                {plan.suffix && <span className="text-xs font-bold text-slate-500">{plan.suffix}</span>}
                {plan.compareAt && (
                  <span className="text-sm font-bold text-slate-400 line-through">
                    {plan.compareAt}
                  </span>
                )}
                {plan.discount && plan.premium && (
                  <span className="mt-3 flex basis-full items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                    <Flame size={14} className="text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                    {plan.discount}
                  </span>
                )}
              </div>
              <p className="mt-2 min-h-10 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{plan.description}</p>
              <ul className="mt-5 flex-1 space-y-3 border-t border-slate-100 pt-5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check size={15} className={plan.premium ? 'text-amber-500' : 'text-emerald-500'} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              {!plan.disabled && (
                <button
                  type="button"
                  onClick={plan.onClick}
                  className={`mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition focus:outline-none focus-visible:ring-2 ${
                    plan.premium
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 shadow-lg shadow-amber-500/20 hover:from-amber-300 hover:to-orange-400 focus-visible:ring-amber-400'
                      : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 focus-visible:ring-blue-400'
                  }`}
                >
                  {plan.premium && <ShieldCheck size={15} aria-hidden="true" />}
                  {plan.button}
                  {plan.onClick && <ArrowRight size={15} aria-hidden="true" />}
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </StudentLayout>
  );
};

export default PremiumPage;
