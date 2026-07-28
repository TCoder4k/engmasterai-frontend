import React from 'react';
import { Award, CheckCircle2, Star } from 'lucide-react';
import { RevealOnScroll, STAGGER_STEP } from '../shared/motion';
import { TESTIMONIALS } from './landingContent';
import { SECTION_IDS } from './sections';

// See landingContent.ts: these reviews are placeholder marketing copy.
const Testimonials: React.FC = () => {
  return (
    <section
      id={SECTION_IDS.testimonials}
      className="scroll-mt-24 py-20 lg:py-28 bg-white dark:bg-ink-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-500/30">
            Đánh giá thực tế
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-4 mb-4">
            Được tin tưởng bởi hàng nghìn chuyên gia &amp; sinh viên
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Xem cách EngMaster AI giúp các kỹ sư, nhà quản lý và sinh viên bứt phá rào cản ngôn ngữ và
            tự tin nâng tầm sự nghiệp.
          </p>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((review, index) => (
            <RevealOnScroll
              key={review.id}
              as="li"
              delay={index * (STAGGER_STEP * 2)}
              className="bg-slate-50/70 dark:bg-ink-950 p-8 rounded-3xl border border-slate-200/80 dark:border-ink-700 shadow-sm hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-500/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-6">
                  <span className="flex items-center gap-1" aria-label={`${review.rating} trên 5 sao`}>
                    {Array.from({ length: review.rating }).map((_, star) => (
                      <Star key={star} className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                    ))}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-blue-100/80 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    {review.scoreImprovement}
                  </span>
                </div>

                <blockquote className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed mb-8 italic">
                  &ldquo;{review.content}&rdquo;
                </blockquote>
              </div>

              <div className="pt-4 border-t border-slate-200/60 dark:border-ink-700 flex items-center gap-4">
                <img
                  src={review.avatar}
                  alt=""
                  loading="lazy"
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-600/20 bg-slate-100 dark:bg-ink-800"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{review.name}</span>
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {review.role} •{' '}
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {review.company}
                    </span>
                  </p>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default Testimonials;
