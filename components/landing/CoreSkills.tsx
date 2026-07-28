import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Headphones,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { DURATION, EASE, SLIDE_DISTANCE } from '../shared/motion';
import { SECTION_IDS } from './sections';

type SkillId = 'grammar' | 'vocab' | 'listening';

interface SkillPreview {
  title?: string;
  example?: string;
  tip?: string;
  word?: string;
  phonetic?: string;
  meaning?: string;
  speaker?: string;
  text?: string;
  feedback?: string;
}

interface Skill {
  id: SkillId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  iconBg: string;
  description: string;
  bullets: string[];
  /** The real module this skill maps to, so the card is a way in. */
  to: string;
  cta: string;
  preview: SkillPreview;
}

// The three skills are the three modules the app actually ships
// (/grammar, /vocab, /practice/listening), so each panel ends in a link
// that opens the thing it just described.
const SKILLS: Skill[] = [
  {
    id: 'grammar',
    title: '1. Ngữ pháp tự nhiên',
    subtitle: 'Nắm vững cấu trúc không cần học vẹt',
    icon: BookOpen,
    iconBg: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
    description:
      'Học ngữ pháp thông qua bối cảnh giao tiếp thực tế thay vì công thức khô khan. Mỗi bài học được chia nhỏ thành các thẻ khái niệm dễ tiếp thu.',
    bullets: [
      'Thẻ lý thuyết tách nhỏ theo nguyên lý Micro-learning',
      'Phân tích câu ví dụ trực quan bằng sơ đồ ngữ nghĩa',
      'Nhận diện lỗi sai ngữ pháp thường gặp của người Việt',
      'Luyện tập áp dụng ngay vào bài viết & hội thoại',
    ],
    to: '/grammar',
    cta: 'Xem lộ trình ngữ pháp',
    preview: {
      title: 'Quy tắc: Hiện tại tiếp diễn vs. Hiện tại đơn',
      example: 'I am working on the Q3 marketing report right now.',
      tip: 'Dùng "am working" vì hành động đang diễn ra tại thời điểm nói.',
    },
  },
  {
    id: 'vocab',
    title: '2. Từ vựng ghi nhớ sâu',
    subtitle: 'Thuật toán Spaced Repetition (SRS)',
    icon: BookMarked,
    iconBg:
      'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30',
    description:
      'Hệ thống tự động theo dõi mức độ nhớ của bạn với từng từ vựng và tự xếp lịch nhắc lại ngay trước thời điểm bộ não sắp quên.',
    bullets: [
      'Bộ thẻ Flashcards đa phương tiện (Phát âm, Hình ảnh, Câu ví dụ)',
      'Thuật toán Spaced Repetition phân bổ thời gian ôn tối ưu',
      'Phân loại từ vựng theo chuyên ngành (IT, Marketing, Tài chính)',
      'Đo lường dung lượng vốn từ active/passive theo ngày',
    ],
    to: '/vocab',
    cta: 'Khám phá thư viện từ',
    preview: {
      word: 'Inquire',
      phonetic: '/ɪnˈkwaɪər/',
      meaning: 'Hỏi thăm, yêu cầu thông tin (Trang trọng)',
      example: 'I am writing to inquire about your services.',
    },
  },
  {
    id: 'listening',
    title: '3. Nghe & Luyện phát âm',
    subtitle: 'Nhận diện giọng nói & Sửa lỗi khẩu hình',
    icon: Headphones,
    iconBg:
      'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
    description:
      'Luyện nghe phản xạ với tốc độ nói tự nhiên của người bản xứ kèm bản phụ đề song ngữ tương tác và chấm điểm chuẩn âm từng âm tiết.',
    bullets: [
      'Bản chép lời tương tác (Interactive Transcript) bấm nghe từng đoạn',
      'Công nghệ nhận diện sóng âm chấm điểm độ chuẩn IPA',
      'Phân tích lướt âm, nối âm (Linking sounds) & trọng âm câu',
      'Luyện nói phản xạ với AI Roleplay không áp lực',
    ],
    to: '/practice/listening',
    cta: 'Bắt đầu luyện nghe',
    preview: {
      title: 'Luyện nghe đoạn hội thoại Business',
      speaker: 'Sarah (Native Speaker - US Accent)',
      text: 'Would you mind sending over the updated proposal by 5 PM?',
      feedback: 'Điểm phát âm: 95/100 • Chú ý nối âm "mind sending"',
    },
  },
];

const CoreSkills: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SkillId>('grammar');
  const current = SKILLS.find((skill) => skill.id === activeTab) ?? SKILLS[0];

  return (
    <section id={SECTION_IDS.skills} className="scroll-mt-24 py-20 lg:py-28 bg-white dark:bg-ink-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-500/30">
            Bạn sẽ học gì
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-4 mb-4">
            Ba kỹ năng cốt lõi, một lộ trình rõ ràng
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Ngữ pháp, từ vựng và nghe phản xạ — mỗi kỹ năng được thiết kế theo lộ trình khoa học, kết
            hợp cơ chế lặp lại ngắt quãng để bạn ghi nhớ vĩnh viễn.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Real tabs, not clickable divs: keyboard reachable, and a screen
              reader is told which panel each one controls. */}
          <div
            role="tablist"
            aria-label="Ba kỹ năng cốt lõi"
            className="lg:col-span-5 flex flex-col gap-4"
          >
            {SKILLS.map((skill) => {
              const Icon = skill.icon;
              const isActive = activeTab === skill.id;

              return (
                <button
                  key={skill.id}
                  type="button"
                  role="tab"
                  id={`skill-tab-${skill.id}`}
                  aria-selected={isActive}
                  aria-controls="skill-panel"
                  onClick={() => setActiveTab(skill.id)}
                  className={`p-6 rounded-2xl border text-left transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-50/70 dark:bg-blue-500/10 border-blue-600 dark:border-blue-500 shadow-md ring-1 ring-blue-600/30'
                      : 'bg-white dark:bg-ink-900 border-slate-200/80 dark:border-ink-700 hover:border-slate-300 dark:hover:border-ink-600 hover:bg-slate-50/50 dark:hover:bg-ink-850 hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className={`p-3 rounded-xl border shrink-0 ${skill.iconBg}`}>
                      <Icon className="w-6 h-6" aria-hidden={true} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                          {skill.title}
                        </span>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
                        )}
                      </span>
                      <span className="block text-xs font-semibold text-blue-700 dark:text-blue-400 mt-0.5">
                        {skill.subtitle}
                      </span>
                      <span className="block text-sm text-slate-600 dark:text-slate-300 mt-2">
                        {skill.description}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                id="skill-panel"
                role="tabpanel"
                aria-labelledby={`skill-tab-${activeTab}`}
                initial={{ opacity: 0, x: SLIDE_DISTANCE }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -SLIDE_DISTANCE }}
                transition={{ duration: DURATION.base, ease: EASE }}
                className="bg-slate-900 dark:bg-ink-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 dark:border-ink-700 relative overflow-hidden"
              >
                <div
                  className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"
                  aria-hidden="true"
                />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 rounded-full bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
                      Minh họa phương pháp
                    </span>
                    <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  </div>

                  <h3 className="text-2xl font-bold text-white tracking-tight mb-3">{current.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed mb-6">{current.description}</p>

                  <ul className="space-y-2.5 mb-8">
                    {current.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                        <span className="text-xs sm:text-sm text-slate-200 font-medium">{bullet}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="p-5 rounded-2xl bg-slate-800/90 dark:bg-ink-900 border border-slate-700/80 dark:border-ink-700">
                    <p className="text-[10px] font-mono font-bold uppercase text-slate-400 mb-2 tracking-wider">
                      Trải nghiệm giao diện học tập
                    </p>

                    {current.id === 'grammar' && (
                      <div>
                        <h4 className="text-sm font-bold text-blue-300 mb-1">{current.preview.title}</h4>
                        <p className="p-3 bg-slate-900/80 dark:bg-ink-950 rounded-xl border border-slate-700/50 dark:border-ink-700 my-2 text-sm font-semibold text-white font-mono">
                          &ldquo;{current.preview.example}&rdquo;
                        </p>
                        <p className="text-xs text-slate-300 italic">💡 Gợi ý AI: {current.preview.tip}</p>
                      </div>
                    )}

                    {current.id === 'vocab' && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xl font-bold text-white">{current.preview.word}</span>
                          <span className="text-xs font-mono text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded">
                            {current.preview.phonetic}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-300 mb-2">{current.preview.meaning}</p>
                        <p className="p-3 bg-slate-900/80 dark:bg-ink-950 rounded-xl border border-slate-700/50 dark:border-ink-700 text-xs text-slate-200">
                          Ví dụ:{' '}
                          <span className="text-amber-300 italic">
                            &ldquo;{current.preview.example}&rdquo;
                          </span>
                        </p>
                      </div>
                    )}

                    {current.id === 'listening' && (
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-semibold text-emerald-400">
                            {current.preview.speaker}
                          </span>
                          <span className="p-1.5 rounded-lg bg-blue-600 text-white text-xs flex items-center gap-1 font-bold">
                            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                            Phát mẫu
                          </span>
                        </div>
                        <p className="p-3 bg-slate-900/80 dark:bg-ink-950 rounded-xl border border-slate-700/50 dark:border-ink-700 mb-2 text-sm font-medium text-white italic">
                          &ldquo;{current.preview.text}&rdquo;
                        </p>
                        <p className="text-xs text-emerald-300 font-medium">✓ {current.preview.feedback}</p>
                      </div>
                    )}
                  </div>

                  <Link
                    to={current.to}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-blue-300 hover:text-white transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    {current.cta}
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CoreSkills;
