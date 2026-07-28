import React, { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { DURATION, EASE } from '../shared/motion';
import { FAQS } from './landingContent';
import { SECTION_IDS } from './sections';

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id={SECTION_IDS.faq} className="scroll-mt-24 py-20 lg:py-28 bg-white dark:bg-ink-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-500/30">
            Giải đáp thắc mắc
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-4 mb-4">
            Câu hỏi thường gặp (FAQ)
          </h2>
          <p className="text-base text-slate-600 dark:text-slate-300">
            Mọi thông tin bạn cần biết về phương pháp học và dịch vụ EngMaster AI.
          </p>
        </div>

        <ul className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            const panelId = `${baseId}-faq-${index}`;

            return (
              <li
                key={faq.question}
                className="border border-slate-200/90 dark:border-ink-700 rounded-2xl overflow-hidden bg-white dark:bg-ink-950 transition-colors duration-300 hover:border-blue-300 dark:hover:border-blue-500/40"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-ink-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white pr-2">
                    {faq.question}
                  </span>
                  <span
                    className={`p-1.5 rounded-full shrink-0 transition-all duration-300 ${
                      isOpen
                        ? 'rotate-180 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <ChevronDown className="w-5 h-5" aria-hidden="true" />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="answer"
                      id={panelId}
                      // Height only. An opacity-0 start would leave the
                      // answer genuinely unreadable if the animation never
                      // runs — the same rule the theory cards follow.
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      transition={{ duration: DURATION.base, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <p className="p-5 sm:p-6 pt-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-ink-700 bg-slate-50/50 dark:bg-ink-900">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>

        <div className="mt-12 p-6 rounded-2xl bg-blue-50/80 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <span className="p-3 bg-blue-600 text-white rounded-xl shrink-0">
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Vẫn còn thắc mắc khác?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Đội ngũ chuyên viên giáo dục luôn sẵn sàng hỗ trợ bạn 24/7.
              </p>
            </div>
          </div>
          <a
            href="mailto:support@engmaster.ai"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Liên hệ hỗ trợ ngay
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
