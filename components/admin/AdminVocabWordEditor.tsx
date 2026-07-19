import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { handleAuthError } from '../../services/apiError';
import {
  getManagedWord,
  createWord,
  updateWord,
  uploadWordAudio,
  uploadWordImage,
  WordMeaningDto,
  WordExampleDto,
} from '../../services/vocabWordService';
import { CefrLevel, PartOfSpeech } from '../../types';
import { ArrowLeft, Plus, Trash2, Upload, X } from 'lucide-react';

const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const PART_OF_SPEECH_OPTIONS: PartOfSpeech[] = [
  'NOUN', 'VERB', 'ADJECTIVE', 'ADVERB', 'PRONOUN', 'PREPOSITION',
  'CONJUNCTION', 'INTERJECTION', 'DETERMINER', 'PHRASE', 'IDIOM',
];

interface MeaningRow {
  partOfSpeech: PartOfSpeech | '';
  meaning: string;
}

interface ExampleRow {
  sentence: string;
  translation: string;
}

const emptyMeaning: MeaningRow = { partOfSpeech: '', meaning: '' };
const emptyExample: ExampleRow = { sentence: '', translation: '' };

// Small local tag-input: type a value, press Enter or click Add, it becomes
// a removable chip. Not extracted to shared/ — it's only used on this one
// page for the four relation arrays.
const TagInput: React.FC<{ label: string; values: string[]; onChange: (values: string[]) => void }> = ({
  label,
  values,
  onChange,
}) => {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft('');
  };

  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center space-x-1 bg-indigo-50 text-indigo-600 text-xs font-semibold px-2.5 py-1 rounded-lg"
          >
            <span>{v}</span>
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex space-x-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Nhập rồi bấm Enter..."
          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
        >
          Thêm
        </button>
      </div>
    </div>
  );
};

const AdminVocabWordEditor: React.FC = () => {
  const navigate = useNavigate();
  const { wordId } = useParams<{ wordId: string }>();
  const isEditing = Boolean(wordId);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState('');
  const [ipa, setIpa] = useState('');
  const [cefrLevel, setCefrLevel] = useState<CefrLevel | ''>('');
  const [audioUrl, setAudioUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [antonyms, setAntonyms] = useState<string[]>([]);
  const [collocations, setCollocations] = useState<string[]>([]);
  const [wordFamily, setWordFamily] = useState<string[]>([]);
  const [meanings, setMeanings] = useState<MeaningRow[]>([emptyMeaning]);
  const [examples, setExamples] = useState<ExampleRow[]>([]);

  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (!wordId) return;
    setIsLoading(true);
    getManagedWord(wordId)
      .then((word) => {
        setText(word.text);
        setIpa(word.ipa || '');
        setCefrLevel(word.cefrLevel || '');
        setAudioUrl(word.audioUrl || '');
        setImageUrl(word.imageUrl || '');
        setSynonyms(word.synonyms);
        setAntonyms(word.antonyms);
        setCollocations(word.collocations);
        setWordFamily(word.wordFamily);
        setMeanings(
          word.meanings.length > 0
            ? word.meanings.map((m) => ({ partOfSpeech: m.partOfSpeech || '', meaning: m.meaning }))
            : [emptyMeaning],
        );
        setExamples(word.examples.map((e) => ({ sentence: e.sentence, translation: e.translation || '' })));
      })
      .catch((err) => setError(handleAuthError(err, navigate)))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordId]);

  const addMeaning = () => setMeanings((m) => [...m, emptyMeaning]);
  const removeMeaning = (index: number) => setMeanings((m) => m.filter((_, i) => i !== index));
  const updateMeaning = (index: number, patch: Partial<MeaningRow>) =>
    setMeanings((m) => m.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const addExample = () => setExamples((e) => [...e, emptyExample]);
  const removeExample = (index: number) => setExamples((e) => e.filter((_, i) => i !== index));
  const updateExample = (index: number, patch: Partial<ExampleRow>) =>
    setExamples((e) => e.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const handleUploadAudio = async (file: File) => {
    if (!wordId) return;
    setIsUploadingAudio(true);
    setError(null);
    try {
      const updated = await uploadWordAudio(wordId, file);
      setAudioUrl(updated.audioUrl || '');
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!wordId) return;
    setIsUploadingImage(true);
    setError(null);
    try {
      const updated = await uploadWordImage(wordId, file);
      setImageUrl(updated.imageUrl || '');
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const meaningDtos: WordMeaningDto[] = meanings
      .filter((m) => m.meaning.trim() !== '')
      .map((m) => ({
        partOfSpeech: m.partOfSpeech || undefined,
        meaning: m.meaning.trim(),
      }));

    const exampleDtos: WordExampleDto[] = examples
      .filter((ex) => ex.sentence.trim() !== '')
      .map((ex) => ({
        sentence: ex.sentence.trim(),
        translation: ex.translation.trim() || undefined,
      }));

    if (meaningDtos.length === 0) {
      setError('Cần ít nhất một nghĩa cho từ này.');
      setIsSaving(false);
      return;
    }

    try {
      if (isEditing && wordId) {
        // Full-page editor always holds the complete current state, so every
        // save sends every field — nullable fields (ipa/audioUrl/imageUrl/
        // cefrLevel) as an explicit value or `null` to clear, matching the
        // backend's null-vs-undefined convention (omitting a key means
        // "unchanged", which never applies here since we always know the
        // current value).
        await updateWord(wordId, {
          text: text.trim(),
          ipa: ipa.trim() || null,
          audioUrl: audioUrl.trim() || null,
          imageUrl: imageUrl.trim() || null,
          cefrLevel: cefrLevel || null,
          synonyms,
          antonyms,
          collocations,
          wordFamily,
          meanings: meaningDtos,
          examples: exampleDtos,
        });
      } else {
        const created = await createWord({
          text: text.trim(),
          ipa: ipa.trim() || undefined,
          audioUrl: audioUrl.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          cefrLevel: cefrLevel || undefined,
          synonyms,
          antonyms,
          collocations,
          wordFamily,
          meanings: meaningDtos,
          examples: exampleDtos,
        });
        // Move into edit mode on the new word so audio/image upload becomes
        // available (it needs an id) without a second round trip.
        navigate(`/admin/vocab/words/${created.id}/edit`, { replace: true });
        setIsSaving(false);
        return;
      }
      navigate('/admin/vocab/words');
    } catch (err) {
      setError(handleAuthError(err, navigate));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-[#fbfcfd]">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AdminHeader />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-sm font-medium text-slate-400">Đang tải...</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#fbfcfd]">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-8">
          <Link
            to="/admin/vocab/words"
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors mb-4"
          >
            <ArrowLeft size={14} />
            <span>Quay lại Ngân hàng từ</span>
          </Link>

          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-6">
            {isEditing ? `Chỉnh sửa: ${text}` : 'Thêm từ mới'}
          </h1>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium px-4 py-3 rounded-2xl mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
            <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Thông tin cơ bản</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Từ</label>
                  <input
                    type="text"
                    required
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Phiên âm (IPA)</label>
                  <input
                    type="text"
                    value={ipa}
                    onChange={(e) => setIpa(e.target.value)}
                    placeholder="/həˈloʊ/"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Cấp độ CEFR</label>
                  <select
                    value={cefrLevel}
                    onChange={(e) => setCefrLevel(e.target.value as CefrLevel | '')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  >
                    <option value="">— Không chọn —</option>
                    {CEFR_LEVELS.map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Âm thanh & Hình ảnh</h2>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Audio URL</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                  {isEditing && (
                    <label className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer">
                      <Upload size={14} />
                      <span>{isUploadingAudio ? 'Đang tải...' : 'Tải lên'}</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        disabled={isUploadingAudio}
                        onChange={(e) => e.target.files?.[0] && handleUploadAudio(e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
                {!isEditing && (
                  <p className="text-[11px] text-slate-400 mt-1.5">Lưu từ trước để có thể tải file audio lên.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Image URL</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                  {isEditing && (
                    <label className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer">
                      <Upload size={14} />
                      <span>{isUploadingImage ? 'Đang tải...' : 'Tải lên'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingImage}
                        onChange={(e) => e.target.files?.[0] && handleUploadImage(e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Nghĩa (bắt buộc ≥ 1)</h2>
                <button
                  type="button"
                  onClick={addMeaning}
                  className="flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  <Plus size={14} />
                  <span>Thêm nghĩa</span>
                </button>
              </div>
              {meanings.map((row, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <select
                    value={row.partOfSpeech}
                    onChange={(e) => updateMeaning(index, { partOfSpeech: e.target.value as PartOfSpeech | '' })}
                    className="w-40 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  >
                    <option value="">— Loại từ —</option>
                    {PART_OF_SPEECH_OPTIONS.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={row.meaning}
                    onChange={(e) => updateMeaning(index, { meaning: e.target.value })}
                    placeholder="Nghĩa của từ..."
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                  {meanings.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMeaning(index)}
                      className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </section>

            <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Ví dụ (tùy chọn)</h2>
                <button
                  type="button"
                  onClick={addExample}
                  className="flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  <Plus size={14} />
                  <span>Thêm ví dụ</span>
                </button>
              </div>
              {examples.map((row, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={row.sentence}
                      onChange={(e) => updateExample(index, { sentence: e.target.value })}
                      placeholder="Câu ví dụ..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                    />
                    <input
                      type="text"
                      value={row.translation}
                      onChange={(e) => updateExample(index, { translation: e.target.value })}
                      placeholder="Bản dịch (tùy chọn)..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExample(index)}
                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </section>

            <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Từ liên quan (tùy chọn)</h2>
              <TagInput label="Từ đồng nghĩa (Synonyms)" values={synonyms} onChange={setSynonyms} />
              <TagInput label="Từ trái nghĩa (Antonyms)" values={antonyms} onChange={setAntonyms} />
              <TagInput label="Collocations" values={collocations} onChange={setCollocations} />
              <TagInput label="Họ từ (Word Family)" values={wordFamily} onChange={setWordFamily} />
            </section>

            <div className="flex justify-end space-x-3 pb-8">
              <Link
                to="/admin/vocab/words"
                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-60"
              >
                {isSaving ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo từ'}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
};

export default AdminVocabWordEditor;
