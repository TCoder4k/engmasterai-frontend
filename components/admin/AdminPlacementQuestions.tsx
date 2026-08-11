import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import Modal from '../shared/Modal';
import { handleAuthError } from '../../services/apiError';
import {
  getManagedPlacementQuestions,
  getPlacementCoverage,
  createPlacementQuestion,
  updatePlacementQuestion,
  publishPlacementQuestion,
  unpublishPlacementQuestion,
  deletePlacementQuestion,
  ManagedPlacementQuestion,
  PlacementCoverage,
  PlacementQuestionInput,
} from '../../services/placementService';
import { QuestionType, QuestionDifficulty, QuizQuestionOption } from '../../services/quizService';
import { CourseType } from '../../types';
import { Plus, Pencil, Trash2, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';

// Personalized Onboarding & Placement Test, Phase 2 — admin authoring for
// the dedicated question bank. The per-question editor (type selector,
// options list, per-type correct-answer input) mirrors AdminLessonQuiz.tsx's
// EditableQuestion pattern, adapted to ONE question at a time rather than a
// whole-document array: PlacementQuestion is a flat, independently-CRUD'd
// bank, not questions nested under a LessonTask.

const SECTIONS: { value: CourseType; label: string }[] = [
  { value: 'GRAMMAR', label: 'Ngữ pháp (Grammar)' },
  { value: 'VOCABULARY', label: 'Từ vựng (Vocabulary)' },
  { value: 'LISTENING', label: 'Nghe (Listening)' },
];

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'MULTIPLE_CHOICE', label: 'Trắc nghiệm (Multiple Choice)' },
  { value: 'TRUE_FALSE', label: 'Đúng / Sai (True / False)' },
  { value: 'FILL_BLANK', label: 'Điền từ (Fill Blank)' },
  { value: 'ORDERING', label: 'Sắp xếp câu (Ordering)' },
];

// Required here — unlike the lesson quiz engine's optional difficulty, POST
// /placement/start samples a fixed count per (section, difficulty) bucket,
// so there is no "not set" option.
const DIFFICULTIES: { value: QuestionDifficulty; label: string }[] = [
  { value: 'EASY', label: 'Dễ' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HARD', label: 'Khó' },
];

const inputClass =
  'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-300 dark:focus:border-blue-500';

const newOptionId = () => `opt-${Math.random().toString(36).slice(2)}`;

interface QuestionFormState {
  section: CourseType;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  content: string;
  options: QuizQuestionOption[]; // MULTIPLE_CHOICE / ORDERING only
  correctOptionId: string; // MULTIPLE_CHOICE
  correctBoolean: boolean; // TRUE_FALSE
  acceptedText: string; // FILL_BLANK — one accepted spelling per line
  explanation: string;
  audioUrl: string;
  imageUrl: string;
}

const blankForm = (): QuestionFormState => ({
  section: 'GRAMMAR',
  type: 'MULTIPLE_CHOICE',
  difficulty: 'EASY',
  content: '',
  options: [
    { id: newOptionId(), text: '' },
    { id: newOptionId(), text: '' },
  ],
  correctOptionId: '',
  correctBoolean: true,
  acceptedText: '',
  explanation: '',
  audioUrl: '',
  imageUrl: '',
});

const fromManaged = (q: ManagedPlacementQuestion): QuestionFormState => {
  const base = blankForm();
  const options = q.options ?? [];
  const correctAnswer = q.correctAnswer as Record<string, unknown> | null;
  return {
    ...base,
    section: q.section,
    type: q.type,
    difficulty: q.difficulty,
    content: q.content,
    options: options.length > 0 ? options : base.options,
    correctOptionId:
      q.type === 'MULTIPLE_CHOICE' && correctAnswer ? String(correctAnswer.optionId ?? '') : '',
    correctBoolean: q.type === 'TRUE_FALSE' && correctAnswer ? Boolean(correctAnswer.value) : true,
    acceptedText:
      q.type === 'FILL_BLANK' && correctAnswer && Array.isArray(correctAnswer.accepted)
        ? (correctAnswer.accepted as string[]).join('\n')
        : '',
    explanation: q.explanation ?? '',
    audioUrl: q.audioUrl ?? '',
    imageUrl: q.imageUrl ?? '',
  };
};

// ORDERING's correct order comes from its options array's own position, the
// same rule AdminLessonQuiz.tsx uses.
const toInput = (f: QuestionFormState): PlacementQuestionInput => {
  const trimmedOptions = f.options.map((o) => ({ id: o.id, text: o.text.trim() }));

  let correctAnswer: unknown;
  let options: QuizQuestionOption[] | undefined;
  if (f.type === 'MULTIPLE_CHOICE') {
    options = trimmedOptions;
    correctAnswer = { optionId: f.correctOptionId };
  } else if (f.type === 'TRUE_FALSE') {
    correctAnswer = { value: f.correctBoolean };
  } else if (f.type === 'FILL_BLANK') {
    correctAnswer = {
      accepted: f.acceptedText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  } else {
    options = trimmedOptions;
    correctAnswer = { orderedOptionIds: trimmedOptions.map((o) => o.id) };
  }

  return {
    section: f.section,
    type: f.type,
    difficulty: f.difficulty,
    content: f.content.trim(),
    options,
    correctAnswer,
    explanation: f.explanation.trim() || undefined,
    audioUrl: f.audioUrl.trim() || undefined,
    imageUrl: f.imageUrl.trim() || undefined,
  };
};

const AdminPlacementQuestions: React.FC = () => {
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<ManagedPlacementQuestion[]>([]);
  const [coverage, setCoverage] = useState<PlacementCoverage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sectionFilter, setSectionFilter] = useState<CourseType | ''>('');
  const [difficultyFilter, setDifficultyFilter] = useState<QuestionDifficulty | ''>('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ManagedPlacementQuestion | null>(null);
  const [form, setForm] = useState<QuestionFormState>(blankForm());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    setError(null);
    Promise.all([
      getManagedPlacementQuestions(sectionFilter || undefined, difficultyFilter || undefined, 1, 100),
      getPlacementCoverage(),
    ])
      .then(([list, cov]) => {
        setQuestions(list.data);
        setCoverage(cov);
      })
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionFilter, difficultyFilter]);

  const updateForm = (patch: Partial<QuestionFormState>) => setForm((f) => ({ ...f, ...patch }));

  const updateOption = (optionId: string, text: string) =>
    setForm((f) => ({ ...f, options: f.options.map((o) => (o.id === optionId ? { ...o, text } : o)) }));

  const addOption = () =>
    setForm((f) => ({ ...f, options: [...f.options, { id: newOptionId(), text: '' }] }));

  const removeOption = (optionId: string) =>
    setForm((f) => ({
      ...f,
      options: f.options.filter((o) => o.id !== optionId),
      correctOptionId: f.correctOptionId === optionId ? '' : f.correctOptionId,
    }));

  const moveOption = (optionId: string, direction: -1 | 1) =>
    setForm((f) => {
      const index = f.options.findIndex((o) => o.id === optionId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= f.options.length) return f;
      const options = [...f.options];
      [options[index], options[target]] = [options[target], options[index]];
      return { ...f, options };
    });

  const openCreate = () => {
    setForm(blankForm());
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEdit = (question: ManagedPlacementQuestion) => {
    setEditingQuestion(question);
    setForm(fromManaged(question));
    setFormError(null);
  };

  const closeModal = () => {
    setIsCreateOpen(false);
    setEditingQuestion(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      const input = toInput(form);
      if (editingQuestion) {
        await updatePlacementQuestion(editingQuestion.id, input);
      } else {
        await createPlacementQuestion(input);
      }
      closeModal();
      load();
    } catch (err) {
      setFormError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublish = async (question: ManagedPlacementQuestion) => {
    setPendingActionId(question.id);
    setError(null);
    try {
      if (question.isPublished) {
        await unpublishPlacementQuestion(question.id);
      } else {
        await publishPlacementQuestion(question.id);
      }
      load();
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  const handleDelete = async (question: ManagedPlacementQuestion) => {
    if (!window.confirm('Xóa câu hỏi này khỏi ngân hàng đề kiểm tra đầu vào?')) return;
    setPendingActionId(question.id);
    setError(null);
    try {
      await deletePlacementQuestion(question.id);
      load();
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#fbfcfd] dark:bg-slate-950">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Đề kiểm tra đầu vào (Placement Test)
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                Ngân hàng câu hỏi riêng cho bài kiểm tra đầu vào — 12 câu/lượt (4 Ngữ pháp, 4 Từ vựng, 4 Nghe),
                mỗi phần cần 2 Dễ / 1 Trung bình / 1 Khó đã công khai.
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
            >
              <Plus size={16} />
              <span>Thêm câu hỏi</span>
            </button>
          </div>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-medium px-4 py-3 rounded-2xl">
              {error}
            </div>
          )}

          {coverage && (
            <div
              className={`rounded-3xl border p-5 ${
                coverage.ready
                  ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20'
                  : 'bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                {coverage.ready ? (
                  <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
                )}
                <span
                  className={`text-sm font-bold ${
                    coverage.ready
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {coverage.ready
                    ? 'Ngân hàng đủ câu hỏi để tạo một lượt kiểm tra đầu vào.'
                    : 'Ngân hàng CHƯA đủ câu hỏi — học viên sẽ không thể bắt đầu bài kiểm tra cho tới khi mọi ô dưới đây đủ số lượng.'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {coverage.buckets.map((b) => (
                  <span
                    key={`${b.section}-${b.difficulty}`}
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                      b.sufficient
                        ? 'bg-white/60 dark:bg-white/5 text-emerald-700 dark:text-emerald-300'
                        : 'bg-white text-amber-700 dark:bg-white/10 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-500/40'
                    }`}
                  >
                    {b.section} · {b.difficulty}: {b.available}/{b.required}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value as CourseType | '')}
              className={`${inputClass} max-w-xs`}
            >
              <option value="">Tất cả các phần</option>
              {SECTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value as QuestionDifficulty | '')}
              className={`${inputClass} max-w-xs`}
            >
              <option value="">Tất cả độ khó</option>
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nội dung</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phần</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Độ khó</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loại</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {isLoading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Đang tải...
                      </td>
                    </tr>
                  )}
                  {!isLoading && questions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                        Chưa có câu hỏi nào. Bấm "Thêm câu hỏi" để bắt đầu.
                      </td>
                    </tr>
                  )}
                  {!isLoading && questions.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-sm">{q.content}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{q.section}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{q.difficulty}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{q.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => togglePublish(q)}
                          disabled={pendingActionId === q.id}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                            q.isPublished ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          } hover:opacity-70`}
                        >
                          {q.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                          <span>{pendingActionId === q.id ? '...' : q.isPublished ? 'Công khai' : 'Bản nháp'}</span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => openEdit(q)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(q)}
                            disabled={pendingActionId === q.id}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {(isCreateOpen || editingQuestion) && (
        <Modal
          title={editingQuestion ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
          onClose={closeModal}
        >
          <form onSubmit={submit} className="space-y-4">
            {formError && (
              <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-medium px-4 py-3 rounded-xl">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Phần</label>
                <select
                  value={form.section}
                  onChange={(e) => updateForm({ section: e.target.value as CourseType })}
                  className={inputClass}
                >
                  {SECTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Độ khó</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => updateForm({ difficulty: e.target.value as QuestionDifficulty })}
                  className={inputClass}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Loại câu hỏi</label>
                <select
                  value={form.type}
                  onChange={(e) => updateForm({ type: e.target.value as QuestionType })}
                  className={inputClass}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Nội dung câu hỏi</label>
              <textarea
                required
                rows={2}
                value={form.content}
                onChange={(e) => updateForm({ content: e.target.value })}
                className={inputClass}
              />
            </div>

            {(form.type === 'MULTIPLE_CHOICE' || form.type === 'ORDERING') && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  {form.type === 'MULTIPLE_CHOICE'
                    ? 'Đáp án — chọn ô tròn cho đáp án đúng'
                    : 'Các phần — thứ tự hiện tại LÀ thứ tự đúng'}
                </label>
                <div className="space-y-2">
                  {form.options.map((opt, optIndex) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      {form.type === 'MULTIPLE_CHOICE' && (
                        <input
                          type="radio"
                          name="correct-option"
                          checked={form.correctOptionId === opt.id}
                          onChange={() => updateForm({ correctOptionId: opt.id })}
                          className="w-4 h-4 accent-blue-600 flex-shrink-0"
                          aria-label={`Đáp án đúng là phần ${optIndex + 1}`}
                        />
                      )}
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => updateOption(opt.id, e.target.value)}
                        placeholder={`Lựa chọn ${optIndex + 1}`}
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(opt.id)}
                        disabled={form.options.length <= 2}
                        className="p-1.5 text-slate-300 hover:text-rose-600 disabled:opacity-30 flex-shrink-0"
                        title="Xóa lựa chọn"
                      >
                        <Trash2 size={14} />
                      </button>
                      {form.type === 'ORDERING' && (
                        <div className="flex flex-col flex-shrink-0">
                          <button type="button" onClick={() => moveOption(opt.id, -1)} disabled={optIndex === 0} className="text-[10px] text-slate-400 hover:text-blue-600 disabled:opacity-30">↑</button>
                          <button type="button" onClick={() => moveOption(opt.id, 1)} disabled={optIndex === form.options.length - 1} className="text-[10px] text-slate-400 hover:text-blue-600 disabled:opacity-30">↓</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addOption}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <Plus size={13} /> Thêm lựa chọn
                </button>
              </div>
            )}

            {form.type === 'TRUE_FALSE' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Đáp án đúng</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <input type="radio" name="tf" checked={form.correctBoolean === true} onChange={() => updateForm({ correctBoolean: true })} className="accent-blue-600" />
                    Đúng
                  </label>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <input type="radio" name="tf" checked={form.correctBoolean === false} onChange={() => updateForm({ correctBoolean: false })} className="accent-blue-600" />
                    Sai
                  </label>
                </div>
              </div>
            )}

            {form.type === 'FILL_BLANK' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  Các đáp án được chấp nhận (mỗi dòng 1 cách viết)
                </label>
                <textarea
                  required
                  rows={2}
                  value={form.acceptedText}
                  onChange={(e) => updateForm({ acceptedText: e.target.value })}
                  placeholder={'am\nAm'}
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Giải thích (tùy chọn)</label>
              <textarea
                rows={2}
                value={form.explanation}
                onChange={(e) => updateForm({ explanation: e.target.value })}
                className={inputClass}
              />
            </div>

            {form.section === 'LISTENING' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Audio URL</label>
                <input
                  type="text"
                  value={form.audioUrl}
                  onChange={(e) => updateForm({ audioUrl: e.target.value })}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-60"
              >
                {isSaving ? 'Đang lưu...' : editingQuestion ? 'Lưu thay đổi' : 'Tạo câu hỏi'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminPlacementQuestions;
