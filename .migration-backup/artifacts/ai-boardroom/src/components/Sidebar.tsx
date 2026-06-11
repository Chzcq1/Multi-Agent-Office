import { useState } from "react";
import { Task, UserProfile, deleteTask } from "../lib/api";
import { Trash2, Plus, MessageSquare, Clock, CheckCircle, XCircle, RotateCcw, Loader2, Settings, X } from "lucide-react";

interface SidebarProps {
  tasks: Task[];
  activeTaskId: number | null;
  profile: UserProfile | null;
  onSelectTask: (id: number) => void;
  onNewTask: () => void;
  onTaskDeleted: (id: number) => void;
  onEditProfile: () => void;
  isProcessing: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:            { label: "รอดำเนินการ",  color: "text-amber-500",   icon: <Clock size={11} /> },
  discussing:         { label: "กำลังประชุม",  color: "text-blue-500",    icon: <Loader2 size={11} className="animate-spin" /> },
  completed:          { label: "เสร็จสิ้น",     color: "text-emerald-500", icon: <CheckCircle size={11} /> },
  approved:           { label: "อนุมัติแล้ว",   color: "text-emerald-600", icon: <CheckCircle size={11} /> },
  rejected:           { label: "ปฏิเสธ",        color: "text-red-500",     icon: <XCircle size={11} /> },
  revision_requested: { label: "ขอแก้ไข",       color: "text-orange-500",  icon: <RotateCcw size={11} /> },
};

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

export default function Sidebar({
  tasks, activeTaskId, profile, onSelectTask, onNewTask, onTaskDeleted,
  onEditProfile, isProcessing, isOpen, onClose,
}: SidebarProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  function handleTrashClick(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    setConfirmId(id);
  }

  async function handleConfirmDelete() {
    if (confirmId === null) return;
    const id = confirmId;
    setConfirmId(null);
    setDeletingId(id);
    try {
      await deleteTask(id);
      onTaskDeleted(id);
    } finally {
      setDeletingId(null);
    }
  }

  function handleCancelDelete() {
    setConfirmId(null);
  }

  return (
    <>
      {/* ── DELETE CONFIRMATION MODAL ────────────────────────────────── */}
      {confirmId !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={handleCancelDelete}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 mb-safe-bottom sm:mb-0 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900 leading-snug">
                ต้องการลบประวัติการประชุมนี้ใช่หรือไม่?
              </p>
              <p className="text-xs text-gray-400 mt-1.5">
                การดำเนินการนี้ไม่สามารถยกเลิกได้
              </p>
            </div>
            <div className="border-t border-gray-100">
              <button
                onClick={handleConfirmDelete}
                className="w-full py-3.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
              >
                ลบ
              </button>
              <div className="border-t border-gray-100" />
              <button
                onClick={handleCancelDelete}
                className="w-full py-3.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TABLET/MOBILE BACKDROP (<1024px) ────────────────────────── */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 flex flex-col h-full bg-white border-r border-gray-100
          transform transition-transform duration-300 ease-in-out
          lg:relative lg:w-64 lg:flex-shrink-0 lg:translate-x-0
          ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
        `}
      >
        {/* ── USER PROFILE CARD ──────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            {profile ? (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl">
                    {profile.avatarEmoji}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{profile.displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{profile.role}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-emerald-500 font-medium">● ออนไลน์</span>
                  </div>
                </div>
                <button
                  onClick={onEditProfile}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors"
                  title="แก้ไขโปรไฟล์"
                >
                  <Settings size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-1">
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-2xl">👤</div>
                <div className="flex-1">
                  <p className="text-sm text-gray-400">ยังไม่ตั้งค่าโปรไฟล์</p>
                </div>
              </div>
            )}

            {/* Close button — tablet/mobile only (<1024px) */}
            <button
              onClick={onClose}
              className="lg:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="ปิดเมนู"
            >
              <X size={16} />
            </button>
          </div>

          {/* App title */}
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-base">🏛️</span>
            <span className="font-semibold text-gray-800 text-sm tracking-tight">AI Boardroom</span>
          </div>
        </div>

        {/* ── NEW SESSION BUTTON ──────────────────────────────────────── */}
        <div className="px-4 py-3 flex-shrink-0">
          <button
            onClick={onNewTask}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            <span>เริ่มประชุมใหม่</span>
          </button>
        </div>

        <div className="px-5 pb-2 flex-shrink-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">ประวัติการประชุม</p>
        </div>

        {/* ── TASK LIST ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {tasks.length === 0 && (
            <div className="text-center py-8 px-4">
              <MessageSquare size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">ยังไม่มีประวัติการประชุม</p>
            </div>
          )}
          {tasks.map((task) => {
            const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
            const isActive = task.id === activeTaskId;
            const isDeleting = deletingId === task.id;
            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className={`group relative flex items-center gap-2 px-3 py-3 rounded-xl cursor-pointer transition-colors ${
                  isActive
                    ? "bg-blue-50 border border-blue-100"
                    : "hover:bg-gray-50 active:bg-gray-100 border border-transparent"
                }`}
              >
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={`text-sm leading-snug truncate ${isActive ? "text-blue-700 font-medium" : "text-gray-700"}`}>
                    {truncate(task.userCommand, 32)}
                  </p>
                  <div className={`flex items-center gap-1 mt-1 text-xs ${cfg.color}`}>
                    {cfg.icon}
                    <span>{cfg.label}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleTrashClick(e, task.id)}
                  disabled={isDeleting}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all"
                  title="ลบประวัติ"
                >
                  {isDeleting
                    ? <Loader2 size={13} className="animate-spin text-gray-400" />
                    : <Trash2 size={13} />
                  }
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 pb-safe-bottom">
          <p className="text-xs text-gray-400 text-center">WEF Future Skills Framework</p>
        </div>
      </aside>
    </>
  );
}
