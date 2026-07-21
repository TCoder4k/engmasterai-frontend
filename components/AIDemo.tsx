
import React, { useState } from 'react';
import { Send, BookOpen, CheckCircle, Lightbulb, Heart, RotateCcw, AlertTriangle } from 'lucide-react';
import { CorrectionResult, getCorrection } from '../services/geminiService';

const AIDemo: React.FC = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCorrection(input);
      setResult(data);
    } catch {
      setError('Không thể tạo phản hồi lúc này. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setInput('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-indigo-50/50 p-6 md:p-10 rounded-[3rem] border border-indigo-100 shadow-inner">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          
          {/* Input Side */}
          <div className="space-y-6">
            <label className="block text-slate-700 font-bold mb-2 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              Nhập câu tiếng Anh của bạn
            </label>
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ví dụ: I went to the library yesterday to study English..."
                className="w-full h-40 p-5 rounded-2xl border border-indigo-200 bg-white shadow-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all resize-none text-lg text-slate-800"
              />
              <div className="absolute bottom-4 right-4 text-slate-400 text-xs font-medium">
                {input.length} ký tự
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={handleTest}
                disabled={isLoading || !input.trim()}
                className={`flex-grow py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                  isLoading || !input.trim() 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:-translate-y-0.5'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Đang kiểm tra...
                  </>
                ) : (
                  <>
                    Kiểm tra ngay <Send size={18} />
                  </>
                )}
              </button>
              {(result || error) && (
                <button
                  onClick={reset}
                  className="p-4 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  <RotateCcw size={20} />
                </button>
              )}
            </div>
            
            <p className="text-slate-400 text-sm text-center italic">
              * Công cụ hỗ trợ kiểm tra ngữ pháp và cải thiện khả năng viết tiếng Anh của bạn.
            </p>
          </div>

          {/* Result Side */}
          <div className="relative min-h-[300px]">
            {!result && !isLoading && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-4 p-8 border-2 border-dashed border-indigo-200 rounded-3xl">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md">
                  <BookOpen className="text-indigo-300 w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-indigo-900">Kết quả sẽ hiển thị tại đây</h4>
                  <p className="text-slate-500 text-sm">Nhập câu tiếng Anh để xem phản hồi chi tiết</p>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                 <div className="flex gap-1">
                   <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                   <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                   <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
                 </div>
                 <p className="text-indigo-600 font-semibold animate-pulse">Đang phân tích...</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-4 p-8 border-2 border-dashed border-red-200 rounded-3xl">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md">
                  <AlertTriangle className="text-red-400 w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-red-700">Đã xảy ra lỗi</h4>
                  <p className="text-slate-500 text-sm">{error}</p>
                </div>
              </div>
            )}

            {result && (
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-indigo-50 space-y-6 animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-end">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                    Demo preview — không phải phản hồi AI thật
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold uppercase text-xs tracking-wider">
                    <CheckCircle size={14} /> Câu trả lời đúng
                  </div>
                  <p className="text-xl font-bold text-slate-900 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                    {result.correctedText}
                  </p>
                </div>

                <div className="space-y-2">
                   <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase text-xs tracking-wider">
                    <Lightbulb size={14} /> Giải thích
                  </div>
                  <p className="text-slate-600 leading-relaxed text-sm">
                    {result.explanation}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600 font-bold uppercase text-xs tracking-wider">
                    <Heart size={14} /> Gợi ý tự nhiên hơn
                  </div>
                  <p className="text-slate-800 font-medium italic">
                    "{result.naturalSuggestion}"
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-50">
                   <p className="text-indigo-600 font-bold text-center italic">
                     "{result.encouragement}"
                   </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIDemo;
