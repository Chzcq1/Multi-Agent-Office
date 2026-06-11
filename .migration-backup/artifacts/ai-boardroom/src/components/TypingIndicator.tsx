interface TypingIndicatorProps {
  emoji: string;
  agentName: string;
  agentRole: string;
}

const ROLE_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  manager:    { bg: "bg-blue-50",   border: "border-blue-100",   dot: "bg-blue-400" },
  researcher: { bg: "bg-violet-50", border: "border-violet-100", dot: "bg-violet-400" },
  analyst:    { bg: "bg-amber-50",  border: "border-amber-100",  dot: "bg-amber-400" },
  challenger: { bg: "bg-emerald-50",border: "border-emerald-100",dot: "bg-emerald-400" },
};

const ROLE_LABELS: Record<string, string> = {
  manager: "กำลังวิเคราะห์คำสั่ง...",
  researcher: "กำลังค้นหาข้อมูล...",
  analyst: "กำลังระดมความคิด...",
  challenger: "กำลังวิพากษ์และสรุป...",
};

export default function TypingIndicator({ emoji, agentName, agentRole }: TypingIndicatorProps) {
  const cfg = ROLE_COLORS[agentRole] ?? ROLE_COLORS.manager;
  const label = ROLE_LABELS[agentRole] ?? "กำลังคิด...";

  return (
    <div className={`fade-up flex items-center gap-3 px-4 py-3 rounded-2xl border ${cfg.bg} ${cfg.border}`}>
      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-xl shadow-sm border border-white/80 flex-shrink-0">
        {emoji}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">{agentName}</span>
        <span className="text-sm text-gray-400">{label}</span>
        <div className="flex items-center gap-1 ml-1">
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} dot-1`} />
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} dot-2`} />
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} dot-3`} />
        </div>
      </div>
    </div>
  );
}
