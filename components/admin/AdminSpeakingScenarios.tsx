import React, { useEffect, useState } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import {
  ManagedSpeakingScenario,
  ManagedSpeakingExercise,
  getManagedSpeakingScenarios,
  createSpeakingScenario,
  updateSpeakingScenario,
  publishSpeakingScenario,
  unpublishSpeakingScenario,
  deleteSpeakingScenario,
  getManagedSpeakingExercises,
  createSpeakingExercise,
  updateSpeakingExercise,
  publishSpeakingExercise,
  unpublishSpeakingExercise,
  deleteSpeakingExercise,
  CreateSpeakingScenarioPayload,
  CreateSpeakingExercisePayload,
} from '../../services/speakingAdminService';
import { CefrLevel } from '../../types';
import { Mic, Plus, Edit2, Trash2, ArrowLeft, BookOpen, Power } from 'lucide-react';

const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function AdminSpeakingScenarios() {
  const [scenarios, setScenarios] = useState<ManagedSpeakingScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<ManagedSpeakingScenario | null>(null);
  const [exercises, setExercises] = useState<ManagedSpeakingExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scenario Modal state
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [editingScenario, setEditingScenario] = useState<ManagedSpeakingScenario | null>(null);
  const [scenarioForm, setScenarioForm] = useState<CreateSpeakingScenarioPayload>({
    name: '',
    nameVi: '',
    description: '',
    descriptionVi: '',
    level: 'B1',
    orderIndex: 0,
    isFreeTalk: false,
  });

  // Exercise Modal state
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ManagedSpeakingExercise | null>(null);
  const [exerciseForm, setExerciseForm] = useState<Omit<CreateSpeakingExercisePayload, 'scenarioId'>>({
    title: '',
    titleVi: '',
    description: '',
    descriptionVi: '',
    level: 'B1',
    aiRole: '',
    aiRoleVi: '',
    conversationGoal: '',
    conversationGoalVi: '',
    targetTurns: 5,
    openingLine: '',
    openingLineVi: '',
    orderIndex: 0,
  });

  const loadScenarios = async () => {
    try {
      setLoading(true);
      const data = await getManagedSpeakingScenarios();
      setScenarios(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách kịch bản');
    } finally {
      setLoading(false);
    }
  };

  const loadExercises = async (scenarioId: string) => {
    try {
      setLoading(true);
      const data = await getManagedSpeakingExercises(scenarioId);
      setExercises(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách bài tập');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenarios();
  }, []);

  useEffect(() => {
    if (selectedScenario) {
      loadExercises(selectedScenario.id);
    }
  }, [selectedScenario]);

  // Scenario Handlers
  const handleOpenCreateScenario = () => {
    setEditingScenario(null);
    setScenarioForm({
      name: '',
      nameVi: '',
      description: '',
      descriptionVi: '',
      level: 'B1',
      orderIndex: scenarios.length + 1,
      isFreeTalk: false,
    });
    setShowScenarioModal(true);
  };

  const handleOpenEditScenario = (s: ManagedSpeakingScenario) => {
    setEditingScenario(s);
    setScenarioForm({
      name: s.name,
      nameVi: s.nameVi,
      description: s.description || '',
      descriptionVi: s.descriptionVi || '',
      level: s.level || 'B1',
      orderIndex: s.orderIndex,
      isFreeTalk: s.isFreeTalk,
    });
    setShowScenarioModal(true);
  };

  const handleSaveScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingScenario) {
        await updateSpeakingScenario(editingScenario.id, scenarioForm);
      } else {
        await createSpeakingScenario(scenarioForm);
      }
      setShowScenarioModal(false);
      loadScenarios();
    } catch (err: any) {
      alert(err.message || 'Lưu kịch bản thất bại');
    }
  };

  const handleDeleteScenario = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa chủ đề này?')) return;
    try {
      await deleteSpeakingScenario(id);
      if (selectedScenario?.id === id) {
        setSelectedScenario(null);
      }
      loadScenarios();
    } catch (err: any) {
      alert(err.message || 'Xóa thất bại');
    }
  };

  const handleTogglePublishScenario = async (s: ManagedSpeakingScenario) => {
    try {
      if (s.isPublished) {
        await unpublishSpeakingScenario(s.id);
      } else {
        await publishSpeakingScenario(s.id);
      }
      loadScenarios();
      if (selectedScenario?.id === s.id) {
        const updated = await getManagedSpeakingScenarios();
        const found = updated.find((x) => x.id === s.id);
        if (found) setSelectedScenario(found);
      }
    } catch (err: any) {
      alert(err.message || 'Thay đổi trạng thái thất bại');
    }
  };

  // Exercise Handlers
  const handleOpenCreateExercise = () => {
    if (!selectedScenario) return;
    setEditingExercise(null);
    setExerciseForm({
      title: '',
      titleVi: '',
      description: '',
      descriptionVi: '',
      level: selectedScenario.level || 'B1',
      aiRole: '',
      aiRoleVi: '',
      conversationGoal: '',
      conversationGoalVi: '',
      targetTurns: 5,
      openingLine: '',
      openingLineVi: '',
      orderIndex: exercises.length + 1,
    });
    setShowExerciseModal(true);
  };

  const handleOpenEditExercise = (ex: ManagedSpeakingExercise) => {
    setEditingExercise(ex);
    setExerciseForm({
      title: ex.title,
      titleVi: ex.titleVi,
      description: ex.description,
      descriptionVi: ex.descriptionVi,
      level: ex.level,
      aiRole: ex.aiRole,
      aiRoleVi: ex.aiRoleVi,
      conversationGoal: ex.conversationGoal,
      conversationGoalVi: ex.conversationGoalVi,
      targetTurns: ex.targetTurns,
      openingLine: ex.openingLine,
      openingLineVi: ex.openingLineVi,
      orderIndex: ex.orderIndex,
    });
    setShowExerciseModal(true);
  };

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScenario) return;
    try {
      if (editingExercise) {
        await updateSpeakingExercise(editingExercise.id, exerciseForm);
      } else {
        await createSpeakingExercise({
          ...exerciseForm,
          scenarioId: selectedScenario.id,
        });
      }
      setShowExerciseModal(false);
      loadExercises(selectedScenario.id);
    } catch (err: any) {
      alert(err.message || 'Lưu bài tập thất bại');
    }
  };

  const handleDeleteExercise = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài tập này?')) return;
    try {
      await deleteSpeakingExercise(id);
      if (selectedScenario) loadExercises(selectedScenario.id);
    } catch (err: any) {
      alert(err.message || 'Xóa bài tập thất bại');
    }
  };

  const handleTogglePublishExercise = async (ex: ManagedSpeakingExercise) => {
    try {
      if (ex.isPublished) {
        await unpublishExercise(ex.id);
      } else {
        await publishSpeakingExercise(ex.id);
      }
      if (selectedScenario) loadExercises(selectedScenario.id);
    } catch (err: any) {
      alert(err.message || 'Thay đổi trạng thái thất bại');
    }
  };

  const unpublishExercise = unpublishSpeakingExercise;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 min-w-0">
        <AdminHeader />
        <main className="p-8 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                <Mic size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Quản lý Kịch bản Luyện nói (Speaking Live)</h1>
                <p className="text-sm text-slate-500">Thiết lập các chủ đề hội thoại và kịch bản thực hành với AI Gemini Live</p>
              </div>
            </div>
            {!selectedScenario && (
              <button
                onClick={handleOpenCreateScenario}
                className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm"
              >
                <Plus size={18} />
                <span>Thêm chủ đề mới</span>
              </button>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Breadcrumb / Back button if inside a scenario */}
          {selectedScenario && (
            <div className="mb-6 flex items-center space-x-3">
              <button
                onClick={() => setSelectedScenario(null)}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all"
              >
                <ArrowLeft size={16} />
                <span>Quay lại danh sách chủ đề</span>
              </button>
              <span className="text-slate-300">/</span>
              <span className="text-sm font-bold text-slate-800">{selectedScenario.nameVi} ({selectedScenario.name})</span>
            </div>
          )}

          {/* Main Content Area */}
          {!selectedScenario ? (
            /* Scenarios Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scenarios.map((s) => (
                <div
                  key={s.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <span className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg uppercase">
                        {s.level || 'ALL'}
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleTogglePublishScenario(s)}
                          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            s.isPublished
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                          }`}
                          title="Bấm để chuyển đổi trạng thái xuất bản"
                        >
                          <Power size={12} />
                          <span>{s.isPublished ? 'Đang xuất bản' : 'Bản nháp'}</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditScenario(s)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                          title="Chỉnh sửa chủ đề"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteScenario(s.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          title="Xóa chủ đề"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-1">{s.nameVi}</h3>
                    <p className="text-xs font-medium text-slate-400 mb-3">{s.name}</p>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-4">{s.descriptionVi || s.description || 'Chưa có mô tả'}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      {s.exerciseCount || 0} bài tập kịch bản
                    </span>
                    <button
                      onClick={() => setSelectedScenario(s)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all"
                    >
                      <BookOpen size={14} />
                      <span>Quản lý bài tập</span>
                    </button>
                  </div>
                </div>
              ))}

              {scenarios.length === 0 && !loading && (
                <div className="col-span-full text-center py-16 bg-white border border-slate-200 rounded-2xl">
                  <p className="text-slate-500 font-medium">Chưa có chủ đề Speaking nào được tạo.</p>
                </div>
              )}
            </div>
          ) : (
            /* Exercises List */
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Danh sách bài tập trong chủ đề: {selectedScenario.nameVi}</h2>
                  <span className="text-xs font-semibold text-slate-500">{exercises.length} bài tập kịch bản</span>
                </div>
                <button
                  onClick={handleOpenCreateExercise}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-sm transition-all shadow-sm"
                >
                  <Plus size={16} />
                  <span>Thêm bài tập trong chủ đề</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {exercises.map((ex) => (
                  <div key={ex.id} className="p-6 flex items-start justify-between hover:bg-slate-50/50 transition-all">
                    <div className="space-y-3 flex-1 pr-6">
                      <div className="flex items-center space-x-3">
                        <span className="px-2 py-0.5 text-xs font-bold bg-purple-50 text-purple-700 rounded-md">
                          {ex.level}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">{ex.titleVi} ({ex.title})</h3>
                      </div>
                      <p className="text-sm text-slate-600">{ex.descriptionVi || ex.description || 'Chưa có mô tả'}</p>
                      
                      {/* Metadata Chips Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-purple-50/40 border border-purple-100/60 p-4 rounded-xl text-xs text-slate-700">
                        <div>
                          <span className="block font-bold text-purple-900 mb-0.5">🤖 AI Role</span>
                          <span className="text-slate-600">{ex.aiRoleVi || ex.aiRole || '(Chưa thiết lập)'}</span>
                        </div>
                        <div>
                          <span className="block font-bold text-purple-900 mb-0.5">🎯 Mục tiêu hội thoại</span>
                          <span className="text-slate-600">{ex.conversationGoalVi || ex.conversationGoal || '(Chưa thiết lập)'}</span>
                        </div>
                        <div>
                          <span className="block font-bold text-purple-900 mb-0.5">⏱️ Số lượt (Turns)</span>
                          <span className="text-slate-600">{ex.targetTurns || 5} lượt</span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                        <span className="font-bold text-slate-700 mr-1.5">💬 Câu mở đầu của AI:</span>
                        <span className="italic">
                          {ex.openingLineVi || ex.openingLine ? `"${ex.openingLineVi || ex.openingLine}"` : '(Chưa thiết lập câu mở đầu)'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTogglePublishExercise(ex)}
                        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          ex.isPublished
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                        }`}
                        title="Bấm để chuyển đổi trạng thái xuất bản"
                      >
                        <Power size={12} />
                        <span>{ex.isPublished ? 'Đang xuất bản' : 'Bản nháp'}</span>
                      </button>
                      <button
                        onClick={() => handleOpenEditExercise(ex)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
                        title="Chỉnh sửa bài tập"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteExercise(ex.id)}
                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                        title="Xóa bài tập"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}

                {exercises.length === 0 && !loading && (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    Chưa có bài tập nào trong chủ đề này.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scenario Modal */}
          {showScenarioModal && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  {editingScenario ? 'Chỉnh sửa chủ đề Speaking' : 'Thêm chủ đề Speaking mới'}
                </h3>
                <form onSubmit={handleSaveScenario} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Tên tiếng Anh</label>
                      <input
                        type="text"
                        required
                        value={scenarioForm.name}
                        onChange={(e) => setScenarioForm({ ...scenarioForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ví dụ: Airport Check-in"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Tên tiếng Việt</label>
                      <input
                        type="text"
                        required
                        value={scenarioForm.nameVi}
                        onChange={(e) => setScenarioForm({ ...scenarioForm, nameVi: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ví dụ: Làm thủ tục sân bay"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mô tả tiếng Anh</label>
                    <textarea
                      value={scenarioForm.description || ''}
                      onChange={(e) => setScenarioForm({ ...scenarioForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mô tả tiếng Việt</label>
                    <textarea
                      value={scenarioForm.descriptionVi || ''}
                      onChange={(e) => setScenarioForm({ ...scenarioForm, descriptionVi: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Trình độ (CEFR)</label>
                      <select
                        value={scenarioForm.level || 'B1'}
                        onChange={(e) => setScenarioForm({ ...scenarioForm, level: e.target.value as CefrLevel })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {CEFR_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Thứ tự hiển thị</label>
                      <input
                        type="number"
                        value={scenarioForm.orderIndex || 0}
                        onChange={(e) => setScenarioForm({ ...scenarioForm, orderIndex: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="isFreeTalk"
                      checked={scenarioForm.isFreeTalk || false}
                      onChange={(e) => setScenarioForm({ ...scenarioForm, isFreeTalk: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <label htmlFor="isFreeTalk" className="text-sm font-semibold text-slate-700">
                      Đây là chủ đề Free Talk (Tự do)
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowScenarioModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all"
                    >
                      Lưu chủ đề
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Exercise Modal */}
          {showExerciseModal && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  {editingExercise ? 'Chỉnh sửa bài tập Speaking' : 'Thêm bài tập Speaking mới'}
                </h3>
                <form onSubmit={handleSaveExercise} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Tiêu đề bài tập (EN)</label>
                      <input
                        type="text"
                        required
                        value={exerciseForm.title}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, title: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Tiêu đề bài tập (VI)</label>
                      <input
                        type="text"
                        required
                        value={exerciseForm.titleVi}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, titleVi: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mô tả (EN)</label>
                      <textarea
                        required
                        value={exerciseForm.description}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mô tả (VI)</label>
                      <textarea
                        required
                        value={exerciseForm.descriptionVi}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, descriptionVi: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Vai trò của AI (EN)</label>
                      <input
                        type="text"
                        required
                        value={exerciseForm.aiRole}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, aiRole: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                        placeholder="e.g. Airport receptionist"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Vai trò của AI (VI)</label>
                      <input
                        type="text"
                        required
                        value={exerciseForm.aiRoleVi}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, aiRoleVi: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                        placeholder="Ví dụ: Nhân viên tiếp tân sân bay"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mục tiêu hội thoại (EN)</label>
                      <input
                        type="text"
                        required
                        value={exerciseForm.conversationGoal}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, conversationGoal: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mục tiêu hội thoại (VI)</label>
                      <input
                        type="text"
                        required
                        value={exerciseForm.conversationGoalVi}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, conversationGoalVi: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Câu mở đầu của AI (EN)</label>
                      <input
                        type="text"
                        required
                        value={exerciseForm.openingLine}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, openingLine: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Câu mở đầu của AI (VI)</label>
                      <input
                        type="text"
                        required
                        value={exerciseForm.openingLineVi}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, openingLineVi: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Trình độ (CEFR)</label>
                      <select
                        value={exerciseForm.level}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, level: e.target.value as CefrLevel })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                      >
                        {CEFR_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Số lượt tối thiểu (Turns)</label>
                      <input
                        type="number"
                        value={exerciseForm.targetTurns}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, targetTurns: parseInt(e.target.value) || 5 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Thứ tự</label>
                      <input
                        type="number"
                        value={exerciseForm.orderIndex}
                        onChange={(e) => setExerciseForm({ ...exerciseForm, orderIndex: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowExerciseModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-all"
                    >
                      Lưu bài tập
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
