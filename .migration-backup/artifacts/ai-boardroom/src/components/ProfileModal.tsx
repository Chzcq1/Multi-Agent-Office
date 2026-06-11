import { useState } from "react";
import { saveProfile, UserProfile } from "../lib/api";
import { Loader2, Check } from "lucide-react";

const AVATAR_OPTIONS = [
  "👨‍💼","👩‍💼","👨‍💻","👩‍💻","🧑‍💼","👨‍🏫","👩‍🏫","🧑‍🚀","👨‍⚕️","👩‍⚕️",
  "🦁","🐯","🦊","🐻","🦅","🌟","💎","🏆","⚡","🎯",
];

const ROLE_PRESETS = [
  "ประธานเจ้าหน้าที่บริหาร (CEO)",
  "ผู้อำนวยการ (Director)",
  "หัวหน้าฝ่ายการตลาด (CMO)",
  "หัวหน้าฝ่ายปฏิบัติการ (COO)",
  "ผู้ก่อตั้ง (Founder)",
  "ผู้จัดการโครงการ",
];

interface ProfileModalProps {
  onComplete: (profile: UserProfile) => void;
  existing?: UserProfile | null;
}

export default function ProfileModal({ onComplete, existing }: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(existing?.displayName ?? "");
  const [role, setRole] = useState(existing?.role ?? "");
  const [avatarEmoji, setAvatarEmoji] = useState(existing?.avatarEmoji ?? "👨‍💼");
  const [customRole, setCustomRole] = useState(
    existing && !ROLE_PRESETS.includes(existing.role) ? existing.role : ""
  );
  const [useCustomRole, setUseCustomRole] = useState(
    existing ? !ROLE_PRESETS.includes(existing.role) : false
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const effectiveRole = useCustomRole ? customRole : role;
  const canSave = displayName.trim().length > 0 && effectiveRole.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const profile = await saveProfile({
        displayName: displayName.trim(),
        role: effectiveRole.trim(),
        avatarEmoji,
      });
      onComplete(profile);
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  const isEdit = !!existing;

  return (
    /* Overlay — slides up from bottom on mobile, centered on desktop */
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      {/*
        Card:
        - Mobile: full-width sheet from bottom, rounded top corners, max 92dvh, scrollable body
        - Desktop: max-w-md centered, fully rounded, same max-height
      */}
      <div className="w-full sm:max-w-md sm:mx-4 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: "92dvh" }}>

        {/* ── HEADER — fixed, never scrolls ─────────────────────────── */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-6 pt-6 pb-5 text-white flex-shrink-0 rounded-t-3xl">
          {/* Drag handle (mobile visual cue) */}
          <div className="w-10 h-1 bg-white/40 rounded-full mx-auto mb-4 sm:hidden" />
          <div className="text-4xl mb-2 text-center">{avatarEmoji}</div>
          <h2 className="text-xl font-semibold text-center">
            {isEdit ? "แก้ไขโปรไฟล์" : "ยินดีต้อนรับสู่ War Room"}
          </h2>
          <p className="text-blue-100 text-sm text-center mt-1">
            {isEdit ? "อัปเดตข้อมูลของคุณ" : "กรุณาตั้งค่าตัวตนของคุณในฐานะผู้นำ"}
          </p>
        </div>

        {/* ── SCROLLABLE BODY ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7 py-5 space-y-5"
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>

          {/* Avatar picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              เลือก Avatar
            </label>
            <div className="grid grid-cols-10 gap-1.5">
              {AVATAR_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setAvatarEmoji(emoji)}
                  className={`w-full aspect-square rounded-xl text-xl flex items-center justify-center transition-all ${
                    avatarEmoji === emoji
                      ? "bg-blue-100 ring-2 ring-blue-400 scale-110"
                      : "bg-gray-50 hover:bg-gray-100 active:bg-gray-200"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              ชื่อที่ต้องการแสดง
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="เช่น คุณสมชาย, ดร. วิชัย"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              ตำแหน่ง / บทบาท
            </label>
            {!useCustomRole ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setRole(preset)}
                      className={`text-left px-3 py-2.5 rounded-xl text-sm transition-all ${
                        role === preset
                          ? "bg-blue-50 border border-blue-300 text-blue-700 font-medium"
                          : "bg-gray-50 border border-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setUseCustomRole(true); setRole(""); }}
                  className="text-sm text-blue-500 hover:text-blue-600 underline py-1"
                >
                  ระบุตำแหน่งเอง…
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="เช่น ผู้อำนวยการฝ่ายนวัตกรรม"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  autoFocus
                />
                <button
                  onClick={() => { setUseCustomRole(false); setCustomRole(""); }}
                  className="text-sm text-gray-400 hover:text-gray-600 underline py-1"
                >
                  เลือกจากรายการ
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Preview card */}
          {displayName && effectiveRole && (
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl flex-shrink-0">
                {avatarEmoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                <p className="text-xs text-gray-500 truncate">{effectiveRole}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-gray-400">ออนไลน์</span>
              </div>
            </div>
          )}

          {/* Save button — inside scroll so it's always reachable */}
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</>
              : <><Check size={16} /> {isEdit ? "บันทึกการเปลี่ยนแปลง" : "เข้าสู่ War Room"}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
