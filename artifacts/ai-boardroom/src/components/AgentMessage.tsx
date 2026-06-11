import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTypewriter } from "../hooks/useTypewriter";
import type { EvidenceQuality } from "../lib/api";

interface AgentMessageProps {
  emoji: string;
  agentName: string;
  agentRole: string;
  message: string;
  isLatest?: boolean;
  animate?: boolean;
  onTypingComplete?: (wasSkipped: boolean) => void;
  evidenceQuality?: EvidenceQuality;
  hasContradiction?: boolean;
}

const ROLE_COLORS: Record<string, { bg: string; border: string; badge: string; label: string }> = {
  manager:     { bg: "bg-blue-50",    border: "border-blue-100",    badge: "bg-blue-100 text-blue-700",       label: "ผู้ประสาน" },
  researcher:  { bg: "bg-violet-50",  border: "border-violet-100",  badge: "bg-violet-100 text-violet-700",   label: "นักวิจัย" },
  analyst:     { bg: "bg-amber-50",   border: "border-amber-100",   badge: "bg-amber-100 text-amber-700",     label: "นักวิเคราะห์" },
  challenger:  { bg: "bg-orange-50",  border: "border-orange-100",  badge: "bg-orange-100 text-orange-700",   label: "ผู้ท้าทาย" },
  factchecker: { bg: "bg-emerald-50", border: "border-emerald-100", badge: "bg-emerald-100 text-emerald-700", label: "ผู้ตรวจสอบ" },
  review:      { bg: "bg-indigo-50",  border: "border-indigo-100",  badge: "bg-indigo-100 text-indigo-700",   label: "ผู้สรุป" },
};

const EVIDENCE_STYLES: Record<EvidenceQuality, { color: string; icon: string }> = {
  "มีหลักฐานรองรับ": { color: "bg-green-100 text-green-700 border border-green-200", icon: "🟢" },
  "รองรับบางส่วน":   { color: "bg-amber-100 text-amber-700 border border-amber-200", icon: "🟡" },
  "เป็นการคาดเดา":   { color: "bg-red-100 text-red-600 border border-red-200",       icon: "🔴" },
};

function EvidenceBadge({ quality }: { quality: EvidenceQuality }) {
  const s = EVIDENCE_STYLES[quality];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${s.color}`}>
      {s.icon} {quality}
    </span>
  );
}

function cleanMessage(text: string): string {
  return text
    .replace(/NEEDS_CLARIFICATION:\s*(true|false)/gi, "")
    .replace(/REVISION_NEEDED:\s*(true|false)/gi, "")
    .replace(/CONFIDENCE_NUM:\s*\d+/gi, "")
    .replace(/CONFIDENCE:\s*\d+/gi, "")
    .replace(/EVIDENCE_QUALITY:\s*.+/gi, "")
    .replace(/LEVEL:\s*[0-3]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function AgentMessage({
  emoji, agentName, agentRole, message, isLatest, animate = false, onTypingComplete,
  evidenceQuality, hasContradiction,
}: AgentMessageProps) {
  const cfg = ROLE_COLORS[agentRole] ?? ROLE_COLORS.manager;
  const fullText = cleanMessage(message);

  const { displayed, done, skip } = useTypewriter(fullText, animate, {
    baseDelay: 18,
    onComplete: onTypingComplete,
  });

  const renderedText = animate ? displayed : fullText;

  return (
    <div className="space-y-0.5">
      {hasContradiction && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700 font-medium">
          <span>⚠️</span>
          <span>พบความขัดแย้งในข้อมูล — ผลการวิเคราะห์อาจต้องตรวจสอบเพิ่มเติม</span>
        </div>
      )}

      <div
        className={`fade-up rounded-2xl border p-4 ${cfg.bg} ${cfg.border} ${isLatest ? "ring-1 ring-offset-1 ring-blue-200" : ""} ${animate && !done ? "cursor-pointer" : ""}`}
        onClick={animate && !done ? skip : undefined}
        title={animate && !done ? "แตะเพื่อดูทั้งหมด" : undefined}
      >
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-lg shadow-sm border border-white/80 flex-shrink-0">
            {emoji}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            <span className="font-semibold text-gray-900 text-sm">{agentName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
            {evidenceQuality && agentRole !== "manager" && (
              <EvidenceBadge quality={evidenceQuality} />
            )}
          </div>
          {animate && !done && (
            <span className="ml-auto text-xs text-gray-400 animate-pulse select-none flex-shrink-0">✍️</span>
          )}
        </div>

        <div className="prose prose-sm max-w-none prose-gray
          prose-p:my-1.5 prose-p:leading-relaxed
          prose-headings:font-semibold prose-headings:text-gray-800 prose-headings:mt-3 prose-headings:mb-1
          prose-h3:text-sm prose-h4:text-sm
          prose-ul:my-1.5 prose-ul:pl-5 prose-li:my-0.5
          prose-ol:my-1.5 prose-ol:pl-5
          prose-strong:text-gray-800 prose-strong:font-semibold
          prose-code:text-xs prose-code:bg-white/70 prose-code:px-1 prose-code:rounded prose-code:text-gray-700
          prose-hr:my-2 prose-hr:border-gray-200
          text-gray-700 text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {renderedText}
          </ReactMarkdown>
        </div>

        {animate && !done && (
          <p className="text-xs text-gray-400 mt-2 text-right select-none">แตะเพื่อดูทั้งหมด</p>
        )}
      </div>
    </div>
  );
}
