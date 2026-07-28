import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  FlaskConical,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { getCorrection } from '../../services/geminiService';
import { DURATION, EASE } from '../shared/motion';
import { SAMPLE_ANALYSIS_PRESETS, SAMPLE_SENTENCES, SentenceAnalysis } from './landingContent';
import { SECTION_IDS } from './sections';

// Illustrative scores for a sentence with no authored preset.
//
// Derived from the text itself rather than Math.random() so the same input
// always scores the same — a number that changes every time you press the
// button reads as broken, not as analysis. It is a placeholder either way:
// nothing in this app grades a sentence.
const derivedScore = (text: string, offset: number): number => {
  let sum = offset;
  for (let index = 0; index < text.length; index += 1) sum += text.charCodeAt(index);
  return 72 + (sum % 24);
};

const SCORE_BARS = [
  { key: 'grammarScore', label: 'Ngữ pháp (Grammar)', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  { key: 'naturalnessScore', label: 'Độ tự nhiên (Naturalness)', text: 'text-blue-400', bar: 'bg-blue-500' },
  { key: 'vocabularyScore', label: 'Vốn từ vựng (Vocabulary)', text: 'text-amber-400', bar: 'bg-amber-500' },
] as const;

const InteractiveDemo: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [inputSentence, setInputSentence] = useState<string>(SAMPLE_SENTENCES[0].text);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SentenceAnalysis | null>(
    SAMPLE_ANALYSIS_PRESETS[SAMPLE_SENTENCES[0].text],
  );
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handlePresetSelect = (index: number) => {
    const { text } = SAMPLE_SENTENCES[index];
    setSelectedPreset(index);
    setInputSentence(text);
    setError(null);
    setAnalysis(SAMPLE_ANALYSIS_PRESETS[text] ?? null);
  };

  const runAnalysis = async () => {
    const text = inputSentence.trim();
    if (!text || isAnalyzing) return;

    const preset = SAMPLE_ANALYSIS_PRESETS[text];
    if (preset) {
      setError(null);
      setAnalysis(preset);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      // The one real call on this page. services/geminiService.ts is the
      // app's documented deterministic mock — it makes no network request
      // and needs no key, but it gives the button a genuine async round
      // trip and keeps the error path reachable.
      const result = await getCorrection(text);
      setAnalysis({
        original: text,
        corrected: result.correctedText,
        grammarScore: derivedScore(text, 0),
        naturalnessScore: derivedScore(text, 7),
        vocabularyScore: derivedScore(text, 13),
        explanation: [result.explanation],
        nativeAlternatives: [result.naturalSuggestion],
        phoneticTip: 'Lưu ý nhấn giọng ở các danh từ và động từ chính trong câu.',
      });
    } catch {
      setAnalysis(null);
      setError('Không thể tạo phản hồi lúc này. Vui lòng thử lại.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePlayAudio = () => {
    setIsPlayingAudio(true);
    window.setTimeout(() => setIsPlayingAudio(false), 2500);
  };

  return (
    <section
      id={SECTION_IDS.demo}
      className="scroll-mt-24 py-20 lg:py-28 bg-white dark:bg-ink-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          {/* Named as a demo here, not only in the result card: the service
              behind this box is a permanent mock with no model behind it. */}
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold mb-4">
            <FlaskConical className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            Bản demo — phản hồi mẫu, không cần đăng ký
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Thử công cụ AI kiểm tra &amp; sửa câu ngay
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">
            Nhập một câu tiếng Anh bất kỳ (hoặc chọn mẫu bên dưới) để xem cách trợ lý trình bày lỗi
            sai, giải thích chi tiết và gợi ý cách diễn đạt tự nhiên hơn.
          </p>
        </div>

        <div className="bg-slate-900 dark:bg-ink-950 text-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-800 dark:border-ink-700 relative overflow-hidden">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              1. Chọn tình huống mẫu hoặc tự nhập câu của bạn:
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_SENTENCES.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handlePresetSelect(index)}
                  aria-pressed={selectedPreset === index}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    selectedPreset === index
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-slate-800 dark:bg-ink-900 border-slate-700 dark:border-ink-700 text-slate-300 hover:bg-slate-700 dark:hover:bg-ink-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative mb-8">
            <label htmlFor="demo-sentence" className="sr-only">
              Câu tiếng Anh cần kiểm tra
            </label>
            <textarea
              id="demo-sentence"
              rows={3}
              value={inputSentence}
              onChange={(event) => setInputSentence(event.target.value)}
              placeholder="Nhập câu tiếng Anh cần kiểm tra tại đây..."
              className="w-full bg-slate-950/80 dark:bg-ink-900 text-white placeholder-slate-500 p-4 sm:p-5 pb-16 sm:pb-5 rounded-2xl border border-slate-700 dark:border-ink-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base font-medium resize-none"
            />
            <button
              type="button"
              onClick={runAnalysis}
              disabled={isAnalyzing || !inputSentence.trim()}
              className="absolute bottom-4 right-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 text-xs sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Đang phân tích...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  Phân tích bằng AI
                </>
              )}
            </button>
          </div>

          <div aria-live="polite">
            {error && (
              <div className="pt-6 border-t border-slate-800 dark:border-ink-700 flex items-center gap-3 text-rose-300">
                <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {analysis && !error && (
                <motion.div
                  key={analysis.corrected}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: DURATION.base, ease: EASE }}
                  className="pt-6 border-t border-slate-800 dark:border-ink-700 grid grid-cols-1 lg:grid-cols-12 gap-8"
                >
                  <div className="lg:col-span-8 space-y-6">
                    <div className="p-5 rounded-2xl bg-slate-950/90 dark:bg-ink-900 border border-emerald-500/30">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          Câu đã được sửa tối ưu:
                        </span>
                        <button
                          type="button"
                          onClick={handlePlayAudio}
                          className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                            isPlayingAudio
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 dark:bg-ink-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                          {isPlayingAudio ? 'Đang đọc mẫu...' : 'Nghe phát âm'}
                        </button>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-white leading-relaxed font-mono">
                        &ldquo;{analysis.corrected}&rdquo;
                      </p>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-blue-400" aria-hidden="true" />
                        Giải thích chi tiết:
                      </h3>
                      <ol className="space-y-2">
                        {analysis.explanation.map((item, index) => (
                          <li
                            key={item}
                            className="p-3 rounded-xl bg-slate-800/60 dark:bg-ink-900 border border-slate-700/60 dark:border-ink-700 text-xs sm:text-sm text-slate-200 flex items-start gap-2.5"
                          >
                            <span className="w-5 h-5 rounded-full bg-blue-900/60 text-blue-300 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                              {index + 1}
                            </span>
                            {item}
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-400" aria-hidden="true" />
                        Cách diễn đạt tự nhiên hơn (Native Phrasing):
                      </h3>
                      <ul className="space-y-2">
                        {analysis.nativeAlternatives.map((alternative) => (
                          <li
                            key={alternative}
                            className="p-3.5 rounded-xl bg-blue-950/40 dark:bg-blue-500/10 border border-blue-800/40 dark:border-blue-500/20 text-xs sm:text-sm text-blue-200 italic font-medium"
                          >
                            &ldquo;{alternative}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="lg:col-span-4 space-y-4">
                    <div className="p-5 rounded-2xl bg-slate-800/80 dark:bg-ink-900 border border-slate-700 dark:border-ink-700">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                        Thang điểm phân tích:
                      </h3>

                      {SCORE_BARS.map((score) => (
                        <div key={score.key} className="mb-3 last:mb-0">
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-300">{score.label}</span>
                            <span className={score.text}>{analysis[score.key]}%</span>
                          </div>
                          <div
                            className="w-full bg-slate-700 dark:bg-ink-800 h-2 rounded-full overflow-hidden"
                            role="presentation"
                          >
                            <motion.div
                              className={`${score.bar} h-full rounded-full`}
                              initial={{ width: 0 }}
                              animate={{ width: `${analysis[score.key]}%` }}
                              transition={{ duration: DURATION.slow, ease: EASE }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-2xl bg-indigo-950/50 dark:bg-indigo-500/10 border border-indigo-800/50 dark:border-indigo-500/20">
                      <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">
                        Mẹo phát âm (Phonetics):
                      </h3>
                      <p className="text-xs text-indigo-100 leading-relaxed">{analysis.phoneticTip}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InteractiveDemo;
