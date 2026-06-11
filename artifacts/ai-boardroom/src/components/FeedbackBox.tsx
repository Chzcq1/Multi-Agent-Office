import { useState } from "react";
import { submitFeedback } from "../lib/api";
import { CheckCircle, XCircle, RotateCcw, Send, Loader2 } from "lucide-react";

interface FeedbackBoxProps {
  taskId: number;
  onFeedbackSubmitted: () => void;
}

export default function FeedbackBox({ taskId, onFeedbackSubmitted }: FeedbackBoxProps) {
  const [revisionText, setRevisionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"buttons" | "revision">("buttons");

  async function handleApprove() {
    setSubmitting(true);
    try {
      await submitFeedback(taskId, "approved");
      onFeedbackSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    try {
      await submitFeedback(taskId, "rejected");
      onFeedbackSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevision() {
    if (!revisionText.trim()) return;
    setSubmitting(true);
    try {
      await submitFeedback(taskId, "revision_requested", revisionText.trim());
      onFeedbackSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">การตัดสินใจของคุณ</p>

      {mode === "buttons" && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            อนุมัติแผน
          </button>
          <button
            onClick={() => setMode("revision")}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RotateCcw size={14} />
            ขอแก้ไข
          </button>
          <button
            onClick={handleReject}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            ปฏิเสธ
          </button>
        </div>
      )}

      {mode === "revision" && (
        <div className="space-y-2">
          <label className="text-sm text-gray-600">ระบุสิ่งที่ต้องการแก้ไข</label>
          <textarea
            value={revisionText}
            onChange={(e) => setRevisionText(e.target.value)}
            placeholder="เช่น ข้อ 2 ไม่เหมาะสม กรุณาปรับให้เน้นการตลาดออนไลน์มากขึ้น..."
            rows={3}
            className="w-full resize-none text-sm rounded-xl border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRevision}
              disabled={submitting || !revisionText.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              ส่งคำขอแก้ไข
            </button>
            <button
              onClick={() => setMode("buttons")}
              disabled={submitting}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 rounded-xl text-sm transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
