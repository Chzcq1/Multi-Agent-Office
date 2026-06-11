import { useState } from "react";
import { X, RotateCcw, Save, Users } from "lucide-react";
import {
  AppSettings, AgentCustoms, SystemPrompts,
  DEFAULT_CUSTOMS, DEFAULT_SYSTEM_PROMPTS,
  saveSettings, resetSettings,
} from "../lib/settings";

const AGENT_ROLES = ["manager", "researcher", "analyst", "challenger", "factchecker", "review"] as const;
const ROLE_LABELS: Record<string, { th: string; color: string; bg: string }> = {
  manager:     { th: "ผู้จัดการกลยุทธ์",   color: "text-blue-600",    bg: "bg-blue-50" },
  researcher:  { th: "นักวิจัย",             color: "text-violet-600",  bg: "bg-violet-50" },
  analyst:     { th: "นักวิเคราะห์",         color: "text-amber-600",   bg: "bg-amber-50" },
  challenger:  { th: "ผู้ท้าทาย",            color: "text-orange-600",  bg: "bg-orange-50" },
  factchecker: { th: "ผู้ตรวจสอบข้อเท็จจริง", color: "text-emerald-600", bg: "bg-emerald-50" },
  review:      { th: "สรุปขั้นสุดท้าย",      color: "text-indigo-600",  bg: "bg-indigo-50" },
};

const EMOJI_OPTIONS = [
  "👩🏻‍💼","👨🏻‍💼","🧑‍💼","👩‍💻","👨‍💻","🔍","💡","⚖️",
  "✅","🎯","🦁","🦊","🐯","🦅","🌟","💎","⚡","🤖","🧠","📊","🎖️","🔬",
];

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [customs, setCustoms] = useState<AgentCustoms>({ ...settings.agentCustoms });
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompts>({ ...settings.systemPrompts });
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateAgent(role: keyof AgentCustoms, field: "name" | "emoji", value: string) {
    setCustoms((prev) => ({ ...prev, [role]: { ...prev[role], [field]: value } }));
    setEmojiPickerFor(null);
  }

  function updatePrompt(role: keyof SystemPrompts, value: string) {
    setSystemPrompts((prev) => ({ ...prev, [role]: value }));
  }

  function handleSave() {
    const newSettings: AppSettings = { agentCustoms: customs, systemPrompts };
    saveSettings(newSettings);
    onSave(newSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleReset() {
    if (!confirm("รีเซ็ตการตั้งค่าทั้งหมดกลับเป็นค่าเริ่มต้น?")) return;
    const defaults = resetSettings();
    setCustoms(defaults.agentCustoms);
    setSystemPrompts(defaults.systemPrompts);
    onSave(defaults);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">ตั้งค่าระบบ</h2>
            <p className="text-xs text-gray-400 mt-0.5">ปรับแต่งชื่อ Emoji และ System Prompt ของแต่ละ Agent (6 Agent)</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-4 pb-0">
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-blue-50 text-blue-600">
            <Users size={14} />
            จัดการ Agent
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              แก้ไขชื่อ Emoji และ System Prompt — Agent แต่ละตัวมีบริบทที่แยกจากกัน (Context Isolation) เพื่อป้องกัน Echo Chamber
            </p>
            {AGENT_ROLES.map((role) => {
              const meta = ROLE_LABELS[role];
              const custom = customs[role];
              return (
                <div key={role} className={`rounded-2xl border border-gray-100 ${meta.bg} p-4 space-y-3`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${meta.color}`}>
                    {meta.th}
                  </p>

                  {/* Name + Emoji row */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <button
                        onClick={() => setEmojiPickerFor(emojiPickerFor === role ? null : role)}
                        className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-2xl hover:border-blue-300 transition-colors shadow-sm"
                      >
                        {custom.emoji}
                      </button>
                      {emojiPickerFor === role && (
                        <div className="absolute z-10 top-14 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-60">
                          <div className="flex flex-wrap gap-1.5">
                            {EMOJI_OPTIONS.map((em) => (
                              <button
                                key={em}
                                onClick={() => updateAgent(role, "emoji", em)}
                                className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg hover:bg-blue-50 transition-colors ${custom.emoji === em ? "bg-blue-100" : ""}`}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 mb-1 block">ชื่อที่แสดง</label>
                      <input
                        type="text"
                        value={custom.name}
                        onChange={(e) => setCustoms((p) => ({ ...p, [role]: { ...p[role], name: e.target.value } }))}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setCustoms((p) => ({ ...p, [role]: DEFAULT_CUSTOMS[role] }));
                        setSystemPrompts((p) => ({ ...p, [role]: DEFAULT_SYSTEM_PROMPTS[role] }));
                      }}
                      className="p-2 rounded-lg hover:bg-white/80 text-gray-300 hover:text-gray-500 transition-colors"
                      title="รีเซ็ต"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>

                  {/* System Prompt textarea */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">
                      บทบาทและหน้าที่ <span className="text-gray-300">(System Prompt)</span>
                    </label>
                    <textarea
                      value={systemPrompts[role]}
                      onChange={(e) => updatePrompt(role, e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition resize-none leading-relaxed"
                      placeholder={`กำหนดบทบาทของ ${custom.name}...`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <RotateCcw size={14} />
            รีเซ็ตทั้งหมด
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Save size={14} />
              {saved ? "บันทึกแล้ว ✓" : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
