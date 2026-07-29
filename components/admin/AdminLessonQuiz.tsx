import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { handleAuthError } from '../../services/apiError';
import {
  getManageQuiz,
  upsertQuiz,
  publishQuiz,
  unpublishQuiz,
  deleteQuiz,
  ManageQuiz,
  QuizFeedbackMode,
  QuestionType,
  QuestionDifficulty,
  QuizQuestionOption,
  UpsertQuestionInput,
  UpsertQuizInput,
} from '../../services/quizService';
import {
  getManagePractice,
  upsertPractice,
  publishPractice,
  unpublishPractice,
  deletePractice,
} from '../../services/practiceService';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

// Sprint 06B — the admin quiz editor. Whole-document editing matching the
// PUT contract: the question array's own order IS orderIndex, so there is
// no separate reorder endpoint, and Duplicate is a pure client-side copy
// (strip the id, insert below) rather than a new API call.
//
// For ORDERING questions, the CURRENT arrangement of its option rows IS the
// authored correct order — the same up/down affordance used to reorder
// questions themselves reorders an ORDERING question's options. Students
// later see those options server-shuffled (quiz.service.ts), never in this
// authored order.

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'MULTIPLE_CHOICE', label: 'Trắc nghiệm (Multiple Choice)' },
  { value: 'TRUE_FALSE', label: 'Đúng / Sai (True / False)' },
  { value: 'FILL_BLANK', label: 'Điền từ (Fill Blank)' },
  { value: 'ORDERING', label: 'Sắp xếp câu (Ordering)' },
];

const DIFFICULTIES: { value: QuestionDifficulty | ''; label: string }[] = [
  { value: '', label: 'Không đặt' },
  { value: 'EASY', label: 'Dễ' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HARD', label: 'Khó' },
];

interface EditableQuestion {
  localId: string;
  id?: string;
  type: QuestionType;
  content: string;
  difficulty: QuestionDifficulty | '';
  options: QuizQuestionOption[]; // MULTIPLE_CHOICE / ORDERING only
  correctOptionId: string; // MULTIPLE_CHOICE
  correctBoolean: boolean; // TRUE_FALSE
  acceptedText: string; // FILL_BLANK — one accepted spelling per line
  explanation: string;
  audioUrl: string;
  imageUrl: string;
}

const newLocalId = () => `local-${Math.random().toString(36).slice(2)}-${Date.now()}`;
const newOptionId = () => `opt-${Math.random().toString(36).slice(2)}`;

const blankQuestion = (): EditableQuestion => ({
  localId: newLocalId(),
  type: 'MULTIPLE_CHOICE',
  content: '',
  difficulty: '',
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

const fromManageQuestion = (q: ManageQuiz['questions'][number]): EditableQuestion => {
  const base = blankQuestion();
  const options = q.options ?? [];
  const correctAnswer = q.correctAnswer as Record<string, unknown> | null;
  return {
    ...base,
    localId: newLocalId(),
    id: q.id,
    type: q.type,
    content: q.content,
    difficulty: q.difficulty ?? '',
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

// ORDERING's correct order comes from its options array's own position —
// the same "array order IS the order" rule the whole-document PUT uses for
// question orderIndex. Reordering the options rearranges the answer key.
const toUpsertInput = (q: EditableQuestion): UpsertQuestionInput => {
  const trimmedOptions = q.options.map((o) => ({ id: o.id, text: o.text.trim() }));

  let correctAnswer: unknown;
  let options: QuizQuestionOption[] | undefined;
  if (q.type === 'MULTIPLE_CHOICE') {
    options = trimmedOptions;
    correctAnswer = { optionId: q.correctOptionId };
  } else if (q.type === 'TRUE_FALSE') {
    correctAnswer = { value: q.correctBoolean };
  } else if (q.type === 'FILL_BLANK') {
    correctAnswer = {
      accepted: q.acceptedText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  } else {
    options = trimmedOptions;
    correctAnswer = { orderedOptionIds: trimmedOptions.map((o) => o.id) };
  }

  return {
    id: q.id,
    type: q.type,
    content: q.content.trim(),
    difficulty: q.difficulty || undefined,
    options,
    correctAnswer,
    explanation: q.explanation.trim() || undefined,
    audioUrl: q.audioUrl.trim() || undefined,
    imageUrl: q.imageUrl.trim() || undefined,
  };
};

const inputClass =
  'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-300 dark:focus:border-blue-500';

// Sprint 06D — the same editor now authors BOTH question-bearing tasks.
//
// Parameterised rather than duplicated: the backend serves quiz and practice
// through one service, the DTOs are identical, and a second 700-line editor
// would be two places to fix every authoring bug. `taskKind` swaps the five
// API calls, the copy, and the route it returns to — nothing else differs.
export type AdminTaskKind = 'quiz' | 'practice';

interface TaskKindConfig {
  api: {
    load: (lessonId: string) => Promise<ManageQuiz>;
    save: (lessonId: string, dto: UpsertQuizInput) => Promise<ManageQuiz>;
    publish: (lessonId: string) => Promise<ManageQuiz>;
    unpublish: (lessonId: string) => Promise<ManageQuiz>;
    remove: (lessonId: string) => Promise<void>;
  };
  title: string;
  // Shown at the top of the editor so an author knows which of the two they
  // are writing, and what makes them different. This is an AUTHORING
  // expectation, not something the engine enforces: nothing classifies a
  // question as advanced automatically and nothing generates one.
  purpose: string;
}

const TASK_KINDS: Record<AdminTaskKind, TaskKindConfig> = {
  quiz: {
    api: {
      load: getManageQuiz,
      save: upsertQuiz,
      publish: publishQuiz,
      unpublish: unpublishQuiz,
      remove: deleteQuiz,
    },
    title: 'Lesson Quiz',
    purpose: 'Checks understanding of the lesson.',
  },
  practice: {
    api: {
      load: getManagePractice,
      save: upsertPractice,
      publish: publishPractice,
      unpublish: unpublishPractice,
      remove: deletePractice,
    },
    title: 'Advanced Practice',
    purpose:
      'Harder, contextual questions that reinforce and extend the lesson — longer sentence context, distractors that reflect common misconceptions, application rather than recall. Difficulty comes from what you write here.',
  },
};

interface AdminLessonQuizProps {
  taskKind?: AdminTaskKind;
}

const AdminLessonQuiz: React.FC<AdminLessonQuizProps> = ({ taskKind = 'quiz' }) => {
  const kind = TASK_KINDS[taskKind];
  const navigate = useNavigate();
  const location = useLocation();
  const { lessonId } = useParams<{ lessonId: string }>();
  const state = location.state as { lessonTitle?: string; courseId?: string; courseTitle?: string } | null;

  const [manage, setManage] = useState<ManageQuiz | null>(null);
  const [passingScorePercent, setPassingScorePercent] = useState('');
  // Sprint 06B.5 — IMMEDIATE matches the server's default for a quiz that
  // does not exist yet, so an author who never touches this control gets
  // exactly what the backend would have chosen.
  const [feedbackMode, setFeedbackMode] = useState<QuizFeedbackMode>('IMMEDIATE');
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    if (!lessonId) return;
    setIsLoading(true);
    setError(null);
    kind.api.load(lessonId)
      .then((res) => {
        setManage(res);
        setPassingScorePercent(res.passingScorePercent ? String(res.passingScorePercent) : '');
        setFeedbackMode(res.feedbackMode);
        setQuestions(res.questions.map(fromManageQuestion));
      })
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const updateQuestion = (localId: string, patch: Partial<EditableQuestion>) => {
    setQuestions((qs) => qs.map((q) => (q.localId === localId ? { ...q, ...patch } : q)));
  };

  const addQuestion = () => setQuestions((qs) => [...qs, blankQuestion()]);

  const duplicateQuestion = (localId: string) => {
    setQuestions((qs) => {
      const index = qs.findIndex((q) => q.localId === localId);
      if (index === -1) return qs;
      const copy: EditableQuestion = {
        ...qs[index],
        localId: newLocalId(),
        id: undefined, // a copy is always a new question server-side
        options: qs[index].options.map((o) => ({ ...o })),
      };
      const next = [...qs];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const removeQuestion = (localId: string) => setQuestions((qs) => qs.filter((q) => q.localId !== localId));

  const moveQuestion = (localId: string, direction: -1 | 1) => {
    setQuestions((qs) => {
      const index = qs.findIndex((q) => q.localId === localId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= qs.length) return qs;
      const next = [...qs];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateOption = (localId: string, optionId: string, text: string) => {
    setQuestions((qs) =>
      qs.map((q) =>
        q.localId === localId
          ? { ...q, options: q.options.map((o) => (o.id === optionId ? { ...o, text } : o)) }
          : q,
      ),
    );
  };

  const addOption = (localId: string) =>
    setQuestions((qs) =>
      qs.map((q) => (q.localId === localId ? { ...q, options: [...q.options, { id: newOptionId(), text: '' }] } : q)),
    );

  const removeOption = (localId: string, optionId: string) =>
    setQuestions((qs) =>
      qs.map((q) =>
        q.localId === localId
          ? {
              ...q,
              options: q.options.filter((o) => o.id !== optionId),
              correctOptionId: q.correctOptionId === optionId ? '' : q.correctOptionId,
            }
          : q,
      ),
    );

  const moveOption = (localId: string, optionId: string, direction: -1 | 1) => {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.localId !== localId) return q;
        const index = q.options.findIndex((o) => o.id === optionId);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= q.options.length) return q;
        const options = [...q.options];
        [options[index], options[target]] = [options[target], options[index]];
        return { ...q, options };
      }),
    );
  };

  const handleSave = async () => {
    if (!lessonId) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const dto = {
        passingScorePercent: passingScorePercent ? Number(passingScorePercent) : undefined,
        feedbackMode,
        questions: questions.map(toUpsertInput),
      };
      const res = await kind.api.save(lessonId, dto);
      setManage(res);
      setQuestions(res.questions.map(fromManageQuestion));
      setNotice('Đã lưu bài quiz.');
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!lessonId || !manage) return;
    setIsPublishing(true);
    setError(null);
    try {
      const res = manage.isPublished
        ? await kind.api.unpublish(lessonId)
        : await kind.api.publish(lessonId);
      setManage(res);
    } catch (err) {
      // Includes the backend's "zero questions" message as-is.
      setError(handleAuthError(err, navigate));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!lessonId) return;
    if (!window.confirm('Xóa toàn bộ bài quiz này? Hành động này không thể hoàn tác.')) return;
    setError(null);
    try {
      await kind.api.remove(lessonId);
      load();
    } catch (err) {
      // Includes the backend's "existing attempts" refusal as-is.
      setError(handleAuthError(err, navigate));
    }
  };

  const backState = state?.courseId ? { courseTitle: state.courseTitle } : undefined;
  const backTo = state?.courseId ? `/admin/courses/${state.courseId}/lessons` : '/admin/courses';

  return (
    <div className="min-h-screen flex bg-[#fbfcfd] dark:bg-slate-950">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <Link
                to={backTo}
                state={backState}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors mb-2"
              >
                <ArrowLeft size={14} />
                <span>Quay lại Bài học</span>
              </Link>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {kind.title} — {state?.lessonTitle ?? lessonId}
              </h1>
              {/* Sprint 06D — the two tasks look identical in this editor, so
                  the difference has to be stated. Otherwise an author has no
                  way to know that Advanced Practice is meant to be harder. */}
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                {kind.purpose}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                Câu hỏi được lưu toàn bộ mỗi lần bấm "Lưu". Học viên chỉ thấy được sau khi Công khai.
              </p>
            </div>

            {manage && (
              <button
                onClick={handleTogglePublish}
                disabled={isPublishing}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 ${
                  manage.isPublished
                    ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {manage.isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
                <span>{isPublishing ? 'Đang xử lý...' : manage.isPublished ? 'Đã công khai' : 'Bản nháp'}</span>
              </button>
            )}
          </div>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-medium px-4 py-3 rounded-2xl">
              {error}
            </div>
          )}
          {notice && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium px-4 py-3 rounded-2xl">
              {notice}
            </div>
          )}

          {isLoading && <p className="text-sm text-slate-400 font-medium">Đang tải...</p>}

          {!isLoading && (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Điểm đạt (%) — để trống dùng mặc định hệ thống
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={passingScorePercent}
                    onChange={(e) => setPassingScorePercent(e.target.value)}
                    placeholder="Ví dụ: 70"
                    className={`${inputClass} max-w-xs`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Chế độ phản hồi
                  </label>
                  <select
                    value={feedbackMode}
                    onChange={(e) => setFeedbackMode(e.target.value as QuizFeedbackMode)}
                    className={`${inputClass} max-w-xs`}
                  >
                    <option value="IMMEDIATE">Phản hồi ngay sau mỗi câu</option>
                    <option value="ON_SUBMIT">Chỉ chấm sau khi nộp bài</option>
                  </select>
                  <p className="mt-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 max-w-md">
                    {feedbackMode === 'IMMEDIATE'
                      ? 'Học viên biết đúng/sai và thấy giải thích ngay sau mỗi câu, rồi câu đó được khoá lại. Phù hợp với bài học.'
                      : 'Học viên làm hết rồi mới thấy kết quả. Phù hợp với bài kiểm tra/thi thử.'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {questions.map((q, index) => (
                  <div
                    key={q.localId}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase">Câu {index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveQuestion(q.localId, -1)}
                          disabled={index === 0}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg disabled:opacity-30"
                          title="Lên"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          onClick={() => moveQuestion(q.localId, 1)}
                          disabled={index === questions.length - 1}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg disabled:opacity-30"
                          title="Xuống"
                        >
                          <ChevronDown size={15} />
                        </button>
                        <button
                          onClick={() => duplicateQuestion(q.localId)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg"
                          title="Nhân bản câu hỏi"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          onClick={() => removeQuestion(q.localId)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                          Loại câu hỏi
                        </label>
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestion(q.localId, { type: e.target.value as QuestionType })}
                          className={inputClass}
                        >
                          {QUESTION_TYPES.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                          Độ khó (tùy chọn)
                        </label>
                        <select
                          value={q.difficulty}
                          onChange={(e) =>
                            updateQuestion(q.localId, { difficulty: e.target.value as QuestionDifficulty | '' })
                          }
                          className={inputClass}
                        >
                          {DIFFICULTIES.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                        Nội dung câu hỏi
                      </label>
                      <textarea
                        rows={2}
                        value={q.content}
                        onChange={(e) => updateQuestion(q.localId, { content: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    {(q.type === 'MULTIPLE_CHOICE' || q.type === 'ORDERING') && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                          {q.type === 'MULTIPLE_CHOICE'
                            ? 'Đáp án — chọn ô tròn cho đáp án đúng'
                            : 'Các phần — thứ tự hiện tại LÀ thứ tự đúng'}
                        </label>
                        <div className="space-y-2">
                          {q.options.map((opt, optIndex) => (
                            <div key={opt.id} className="flex items-center gap-2">
                              {q.type === 'MULTIPLE_CHOICE' && (
                                <input
                                  type="radio"
                                  name={`correct-${q.localId}`}
                                  checked={q.correctOptionId === opt.id}
                                  onChange={() => updateQuestion(q.localId, { correctOptionId: opt.id })}
                                  className="w-4 h-4 accent-blue-600 flex-shrink-0"
                                  aria-label={`Đáp án đúng là phần ${optIndex + 1}`}
                                />
                              )}
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => updateOption(q.localId, opt.id, e.target.value)}
                                placeholder={`Lựa chọn ${optIndex + 1}`}
                                className={`${inputClass} flex-1`}
                              />
                              {q.type === 'ORDERING' && (
                                <div className="flex flex-col flex-shrink-0">
                                  <button
                                    onClick={() => moveOption(q.localId, opt.id, -1)}
                                    disabled={optIndex === 0}
                                    className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                                    title="Lên"
                                  >
                                    <ChevronUp size={13} />
                                  </button>
                                  <button
                                    onClick={() => moveOption(q.localId, opt.id, 1)}
                                    disabled={optIndex === q.options.length - 1}
                                    className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                                    title="Xuống"
                                  >
                                    <ChevronDown size={13} />
                                  </button>
                                </div>
                              )}
                              <button
                                onClick={() => removeOption(q.localId, opt.id)}
                                disabled={q.options.length <= 2}
                                className="p-1.5 text-slate-300 hover:text-rose-600 disabled:opacity-30 flex-shrink-0"
                                title="Xóa lựa chọn"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => addOption(q.localId)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Plus size={13} /> Thêm lựa chọn
                        </button>
                      </div>
                    )}

                    {q.type === 'TRUE_FALSE' && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                          Đáp án đúng
                        </label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <input
                              type="radio"
                              name={`tf-${q.localId}`}
                              checked={q.correctBoolean === true}
                              onChange={() => updateQuestion(q.localId, { correctBoolean: true })}
                              className="accent-blue-600"
                            />
                            Đúng
                          </label>
                          <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <input
                              type="radio"
                              name={`tf-${q.localId}`}
                              checked={q.correctBoolean === false}
                              onChange={() => updateQuestion(q.localId, { correctBoolean: false })}
                              className="accent-blue-600"
                            />
                            Sai
                          </label>
                        </div>
                      </div>
                    )}

                    {q.type === 'FILL_BLANK' && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                          Các đáp án được chấp nhận (mỗi dòng 1 cách viết)
                        </label>
                        <textarea
                          rows={2}
                          value={q.acceptedText}
                          onChange={(e) => updateQuestion(q.localId, { acceptedText: e.target.value })}
                          placeholder={'am\nAm'}
                          className={inputClass}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                        Giải thích (tùy chọn — chỉ hiện khi có nội dung)
                      </label>
                      <textarea
                        rows={2}
                        value={q.explanation}
                        onChange={(e) => updateQuestion(q.localId, { explanation: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                          Audio URL (tùy chọn)
                        </label>
                        <input
                          type="text"
                          value={q.audioUrl}
                          onChange={(e) => updateQuestion(q.localId, { audioUrl: e.target.value })}
                          placeholder="https://..."
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                          Image URL (tùy chọn)
                        </label>
                        <input
                          type="text"
                          value={q.imageUrl}
                          onChange={(e) => updateQuestion(q.localId, { imageUrl: e.target.value })}
                          placeholder="https://..."
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addQuestion}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-sm hover:border-blue-300 hover:text-blue-600 dark:hover:border-blue-500/50 dark:hover:text-blue-400 transition-all"
                >
                  <Plus size={16} /> Thêm câu hỏi
                </button>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleDelete}
                  className="px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                >
                  Xóa toàn bộ quiz
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || questions.length === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-60"
                >
                  <Save size={16} />
                  {isSaving ? 'Đang lưu...' : 'Lưu bài quiz'}
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminLessonQuiz;
