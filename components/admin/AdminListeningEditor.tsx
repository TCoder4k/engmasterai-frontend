import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { handleAuthError } from '../../services/apiError';
import { CefrLevel } from '../../types';
import { formatTimeInput, parseTimeInput } from './listeningTime';
import {
  ListeningMediaProvider,
  ListeningMediaType,
  ListeningMode,
  ManagedListeningCategory,
  ManagedListeningContent,
  SegmentDocumentEntry,
  getListeningCategories,
  getListeningContent,
  publishListeningContent,
  saveListeningSegments,
  unpublishListeningContent,
  updateListeningContent,
} from '../../services/listeningAdminService';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

// Sprint 11 — /admin/listening/:contentId.
//
// TWO INDEPENDENT SAVES, and that split is deliberate. Metadata is a PATCH of
// a handful of columns; the transcript is a whole-document PUT that can carry
// sixty sentences. Folding them into one button would re-send and re-validate
// the entire transcript every time somebody fixed a typo in the title.
//
// THE SEGMENT LIST CARRIES ITS SERVER ID THROUGH EVERY EDIT. A row that keeps
// its id is UPDATED in place; a row with no id is CREATED; a row removed from
// the list is DELETED. From Phase 4A a segment owns the student's progress and
// attempt history, which cascade from it — so dropping an id on save would
// silently destroy that history. Reordering is just saving the array in a new
// order (the backend derives orderIndex from position), which is why there are
// arrow buttons rather than a reorder endpoint.

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const ALL_MODES: ListeningMode[] = ['DICTATION', 'SHADOWING'];

const MODE_LABEL: Record<ListeningMode, string> = {
  DICTATION: 'Dictation — nghe và gõ lại',
  SHADOWING: 'Shadowing — nghe và nhại lại',
};

/** A segment as the editor holds it: server fields plus raw time text. */
interface SegmentRow {
  /** Present only for a segment that already exists server-side. */
  id?: string;
  text: string;
  ipa: string;
  translationVi: string;
  notes: string;
  startInput: string;
  endInput: string;
}

const toRow = (segment: ManagedListeningContent['segments'][number]): SegmentRow => ({
  id: segment.id,
  text: segment.text,
  ipa: segment.ipa ?? '',
  translationVi: segment.translationVi ?? '',
  notes: segment.notes ?? '',
  startInput: formatTimeInput(segment.startTimeMs),
  endInput: formatTimeInput(segment.endTimeMs),
});

const AdminListeningEditor: React.FC = () => {
  const navigate = useNavigate();
  const { contentId } = useParams<{ contentId: string }>();

  const [content, setContent] = useState<ManagedListeningContent | null>(null);
  const [categories, setCategories] = useState<ManagedListeningCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState({
    categoryId: '',
    title: '',
    description: '',
    level: 'B1' as CefrLevel,
    mediaType: 'VIDEO' as ListeningMediaType,
    mediaProvider: 'YOUTUBE' as ListeningMediaProvider,
    mediaUrl: '',
    sourceName: '',
    sourceUrl: '',
    durationInput: '',
    supportedModes: [] as ListeningMode[],
  });

  const [segments, setSegments] = useState<SegmentRow[]>([]);

  const [metaSaving, setMetaSaving] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaSaved, setMetaSaved] = useState(false);

  const [segmentSaving, setSegmentSaving] = useState(false);
  const [segmentError, setSegmentError] = useState<string | null>(null);
  const [segmentSaved, setSegmentSaved] = useState(false);

  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishPending, setPublishPending] = useState(false);

  const applyContent = (loaded: ManagedListeningContent) => {
    setContent(loaded);
    setMeta({
      categoryId: loaded.categoryId,
      title: loaded.title,
      description: loaded.description ?? '',
      level: loaded.level,
      mediaType: loaded.mediaType,
      mediaProvider: loaded.mediaProvider,
      mediaUrl: loaded.mediaUrl,
      sourceName: loaded.sourceName ?? '',
      sourceUrl: loaded.sourceUrl ?? '',
      durationInput:
        loaded.durationMs === null ? '' : formatTimeInput(loaded.durationMs),
      supportedModes: loaded.supportedModes,
    });
    setSegments(loaded.segments.map(toRow));
  };

  useEffect(() => {
    if (!contentId) return;
    setIsLoading(true);
    setError(null);
    Promise.all([getListeningContent(contentId), getListeningCategories()])
      .then(([loaded, cats]) => {
        applyContent(loaded);
        setCategories(cats);
      })
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);

  const toggleMode = (mode: ListeningMode) => {
    setMeta((prev) => ({
      ...prev,
      supportedModes: prev.supportedModes.includes(mode)
        ? prev.supportedModes.filter((m) => m !== mode)
        : [...prev.supportedModes, mode],
    }));
  };

  const saveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentId) return;

    const durationMs = meta.durationInput.trim()
      ? parseTimeInput(meta.durationInput)
      : null;
    if (meta.durationInput.trim() && durationMs === null) {
      setMetaError('Thời lượng không hợp lệ. Dùng dạng 1:23.5 hoặc số giây.');
      return;
    }

    setMetaSaving(true);
    setMetaError(null);
    setMetaSaved(false);
    try {
      const updated = await updateListeningContent(contentId, {
        categoryId: meta.categoryId,
        title: meta.title,
        description: meta.description,
        level: meta.level,
        mediaType: meta.mediaType,
        mediaProvider: meta.mediaProvider,
        mediaUrl: meta.mediaUrl,
        sourceName: meta.sourceName,
        sourceUrl: meta.sourceUrl,
        ...(durationMs === null ? {} : { durationMs }),
        supportedModes: meta.supportedModes,
      });
      setContent(updated);
      setMetaSaved(true);
    } catch (err) {
      setMetaError(handleAuthError(err, navigate));
    } finally {
      setMetaSaving(false);
    }
  };

  const addSegment = () => {
    // A new sentence starts where the previous one ended — the ordinary case
    // when transcribing straight through, and it keeps the document valid for
    // publish without extra typing.
    const previous = segments[segments.length - 1];
    const startMs = previous ? (parseTimeInput(previous.endInput) ?? 0) : 0;
    setSegments([
      ...segments,
      {
        text: '',
        ipa: '',
        translationVi: '',
        notes: '',
        startInput: formatTimeInput(startMs),
        endInput: formatTimeInput(startMs + 4_000),
      },
    ]);
    setSegmentSaved(false);
  };

  const updateSegment = (index: number, patch: Partial<SegmentRow>) => {
    setSegments((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
    setSegmentSaved(false);
  };

  const removeSegment = (index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index));
    setSegmentSaved(false);
  };

  const moveSegment = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= segments.length) return;
    setSegments((prev) => {
      const next = [...prev];
      // Swap carries each row's `id` with it, so a reorder is an UPDATE of two
      // existing rows rather than a delete-and-recreate.
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSegmentSaved(false);
  };

  const saveSegments = async () => {
    if (!contentId) return;

    const document: SegmentDocumentEntry[] = [];
    for (const [index, row] of segments.entries()) {
      const startTimeMs = parseTimeInput(row.startInput);
      const endTimeMs = parseTimeInput(row.endInput);

      if (startTimeMs === null || endTimeMs === null) {
        setSegmentError(
          `Câu ${index + 1}: thời gian không hợp lệ. Dùng dạng 1:23.5 hoặc số giây.`,
        );
        return;
      }
      if (!row.text.trim()) {
        setSegmentError(`Câu ${index + 1}: nội dung không được để trống.`);
        return;
      }

      document.push({
        ...(row.id ? { id: row.id } : {}),
        text: row.text,
        ipa: row.ipa || undefined,
        translationVi: row.translationVi || undefined,
        notes: row.notes || undefined,
        startTimeMs,
        endTimeMs,
      });
    }

    setSegmentSaving(true);
    setSegmentError(null);
    setSegmentSaved(false);
    try {
      const updated = await saveListeningSegments(contentId, document);
      // Re-seed from the server response so newly created rows pick up their
      // real ids — without this, a second save would recreate them.
      applyContent(updated);
      setSegmentSaved(true);
    } catch (err) {
      setSegmentError(handleAuthError(err, navigate));
    } finally {
      setSegmentSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!contentId || !content) return;
    setPublishPending(true);
    setPublishError(null);
    try {
      const updated = content.isPublished
        ? await unpublishListeningContent(contentId)
        : await publishListeningContent(contentId);
      setContent(updated);
    } catch (err) {
      // The backend names the first real problem ("add a media URL",
      // "segment 2 starts at 3000ms, before segment 1 ends at 5000ms"...).
      // Rendered verbatim — a generic "publish failed" would hide the one
      // thing the admin needs.
      setPublishError(handleAuthError(err, navigate));
    } finally {
      setPublishPending(false);
    }
  };

  if (isLoading) {
    return (
      <EditorShell>
        <div className="p-10 text-center text-sm font-semibold text-slate-400">
          Đang tải nội dung...
        </div>
      </EditorShell>
    );
  }

  if (error || !content) {
    return (
      <EditorShell>
        <div className="flex items-start gap-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 mt-px" />
          <span>{error ?? 'Không tìm thấy nội dung.'}</span>
        </div>
      </EditorShell>
    );
  }

  const inputClass =
    'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300';
  const labelClass = 'block text-xs font-bold text-slate-600 mb-1.5';

  return (
    <EditorShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/admin/listening"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            Nội dung Listening
          </Link>
          <h1 className="text-xl font-black text-slate-900 truncate">
            {content.title}
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            {content.category.name}
            <span className="mx-1.5 text-slate-300">·</span>
            {content.level}
            <span className="mx-1.5 text-slate-300">·</span>
            {content.segmentCount} câu
          </p>
        </div>

        <div className="flex items-center gap-2">
          {content.isPublished ? (
            <span className="px-3 py-1.5 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600 rounded-lg">
              Đã xuất bản
            </span>
          ) : (
            <span className="px-3 py-1.5 text-[10px] font-bold uppercase bg-slate-100 text-slate-500 rounded-lg">
              Nháp
            </span>
          )}
          <button
            onClick={togglePublish}
            disabled={publishPending}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {publishPending
              ? 'Đang xử lý...'
              : content.isPublished
                ? 'Gỡ xuất bản'
                : 'Xuất bản'}
          </button>
        </div>
      </div>

      {!content.category.isPublished && (
        <div className="flex items-start gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 mt-px" />
          <span>
            Danh mục "{content.category.name}" đang ở trạng thái nháp. Học viên sẽ
            không thấy nội dung này cho tới khi danh mục được xuất bản, kể cả khi
            nội dung đã xuất bản.
          </span>
        </div>
      )}

      {publishError && (
        <div className="flex items-start gap-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 mt-px" />
          <span>{publishError}</span>
        </div>
      )}

      {/* --- metadata --- */}
      <form
        onSubmit={saveMeta}
        className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-800">Thông tin chung</h2>
          <div className="flex items-center gap-3">
            {metaSaved && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <CheckCircle2 size={13} />
                Đã lưu
              </span>
            )}
            <button
              type="submit"
              disabled={metaSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {metaSaving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tiêu đề</label>
            <input
              type="text"
              required
              maxLength={200}
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Danh mục</label>
            <select
              value={meta.categoryId}
              onChange={(e) => setMeta({ ...meta, categoryId: e.target.value })}
              className={inputClass}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isPublished ? '' : ' (nháp)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Mô tả</label>
          <textarea
            rows={2}
            maxLength={1000}
            value={meta.description}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Trình độ (CEFR)</label>
            <select
              value={meta.level}
              onChange={(e) =>
                setMeta({ ...meta, level: e.target.value as CefrLevel })
              }
              className={inputClass}
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Nguồn media</label>
            <select
              value={meta.mediaProvider}
              onChange={(e) => {
                const provider = e.target.value as ListeningMediaProvider;
                setMeta({
                  ...meta,
                  mediaProvider: provider,
                  mediaType: provider === 'YOUTUBE' ? 'VIDEO' : meta.mediaType,
                });
              }}
              className={inputClass}
            >
              <option value="YOUTUBE">YouTube</option>
              <option value="EXTERNAL_URL">Audio/Video URL</option>
              <option value="CLOUDINARY">Cloudinary</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Loại media</label>
            <select
              value={meta.mediaType}
              disabled={meta.mediaProvider === 'YOUTUBE'}
              onChange={(e) =>
                setMeta({ ...meta, mediaType: e.target.value as ListeningMediaType })
              }
              className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
            >
              <option value="VIDEO">Video</option>
              <option value="AUDIO">Audio</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>URL media</label>
          <input
            type="text"
            maxLength={500}
            value={meta.mediaUrl}
            onChange={(e) => setMeta({ ...meta, mediaUrl: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
            className={inputClass}
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Video YouTube chỉ được <strong>nhúng</strong>. Hệ thống không tải xuống,
            không lưu lại và không tự lấy phụ đề của bên thứ ba.
          </p>
        </div>

        {meta.mediaProvider === 'YOUTUBE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Tên kênh/nguồn (bắt buộc khi xuất bản)</label>
              <input
                type="text"
                maxLength={120}
                value={meta.sourceName}
                onChange={(e) => setMeta({ ...meta, sourceName: e.target.value })}
                placeholder="BBC Learning English"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>URL nguồn (bắt buộc khi xuất bản)</label>
              <input
                type="text"
                maxLength={500}
                value={meta.sourceUrl}
                onChange={(e) => setMeta({ ...meta, sourceUrl: e.target.value })}
                placeholder="https://www.youtube.com/@bbclearningenglish"
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Thời lượng media</label>
          <input
            type="text"
            value={meta.durationInput}
            onChange={(e) => setMeta({ ...meta, durationInput: e.target.value })}
            placeholder="7:24.0"
            className={`${inputClass} max-w-40`}
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Không bắt buộc. Nếu có, khi xuất bản hệ thống sẽ kiểm tra không câu nào
            vượt quá thời lượng này.
          </p>
        </div>

        <div>
          <label className={labelClass}>Chế độ luyện tập</label>
          <div className="space-y-2">
            {ALL_MODES.map((mode) => (
              <label
                key={mode}
                className="flex items-center gap-2.5 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={meta.supportedModes.includes(mode)}
                  onChange={() => toggleMode(mode)}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm font-semibold text-slate-700">
                  {MODE_LABEL[mode]}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Cả hai chế độ dùng chung media, transcript và timestamp bên dưới — không
            cần nhập lại. Shadowing yêu cầu mỗi câu không dài quá 30 giây.
          </p>
        </div>

        {metaError && (
          <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {metaError}
          </p>
        )}
      </form>

      {/* --- segments --- */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-800">
              Transcript ({segments.length} câu)
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Thứ tự trong danh sách chính là thứ tự phát. Sửa câu đã có sẽ giữ
              nguyên ID, nên tiến độ học viên sau này không bị mất.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {segmentSaved && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <CheckCircle2 size={13} />
                Đã lưu
              </span>
            )}
            <button
              onClick={addSegment}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              <Plus size={14} />
              Thêm câu
            </button>
            <button
              onClick={saveSegments}
              disabled={segmentSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {segmentSaving ? 'Đang lưu...' : 'Lưu transcript'}
            </button>
          </div>
        </div>

        {segmentError && (
          <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {segmentError}
          </p>
        )}

        {segments.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-xl">
            <p className="text-sm font-semibold text-slate-500">
              Chưa có câu nào.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Nhấn "Thêm câu" và nhập transcript do bạn tự soạn hoặc sở hữu hợp pháp.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {segments.map((row, index) => (
              <div
                key={row.id ?? `new-${index}`}
                className="border border-slate-200 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    Câu {index + 1}
                    {!row.id && (
                      <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-blue-50 text-blue-600 rounded normal-case">
                        Chưa lưu
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveSegment(index, -1)}
                      disabled={index === 0}
                      title="Lên"
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moveSegment(index, 1)}
                      disabled={index === segments.length - 1}
                      title="Xuống"
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      onClick={() => removeSegment(index)}
                      title="Xóa câu"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <textarea
                  rows={2}
                  maxLength={1000}
                  value={row.text}
                  onChange={(e) => updateSegment(index, { text: e.target.value })}
                  placeholder="Câu tiếng Anh"
                  className={inputClass}
                />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Bắt đầu
                    </label>
                    <input
                      type="text"
                      value={row.startInput}
                      onChange={(e) =>
                        updateSegment(index, { startInput: e.target.value })
                      }
                      placeholder="0:00.0"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Kết thúc
                    </label>
                    <input
                      type="text"
                      value={row.endInput}
                      onChange={(e) =>
                        updateSegment(index, { endInput: e.target.value })
                      }
                      placeholder="0:04.0"
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      IPA
                    </label>
                    <input
                      type="text"
                      maxLength={1000}
                      value={row.ipa}
                      onChange={(e) => updateSegment(index, { ipa: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Nghĩa tiếng Việt
                    </label>
                    <input
                      type="text"
                      maxLength={1000}
                      value={row.translationVi}
                      onChange={(e) =>
                        updateSegment(index, { translationVi: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Ghi chú nội bộ (học viên không thấy)
                    </label>
                    <input
                      type="text"
                      maxLength={1000}
                      value={row.notes}
                      onChange={(e) => updateSegment(index, { notes: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </EditorShell>
  );
};

const EditorShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen bg-slate-50">
    <AdminSidebar />
    <div className="flex-1 min-w-0">
      <AdminHeader />
      <main className="p-8 space-y-6 max-w-5xl">{children}</main>
    </div>
  </div>
);

export default AdminListeningEditor;
