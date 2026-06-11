import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  Task, TaskDetail, SSEEvent, UserProfile, EvidenceQuality,
  getTask, runStep, createTask,
  RunOptions, AgentStep, STEP_ORDER, STEPS_FOR_LEVEL,
} from "../lib/api";
import { AppSettings } from "../lib/settings";
import AgentMessage from "./AgentMessage";
import TypingIndicator from "./TypingIndicator";
import FeedbackBox from "./FeedbackBox";
import WarRoomLayout from "./WarRoomLayout";
import { Send, StopCircle, RotateCcw, ClipboardCopy, ClipboardCheck, Zap, Building2 } from "lucide-react";

type ResponseMode = "quick" | "boardroom";

interface BoardroomChatProps {
  task: Task | null;
  profile: UserProfile | null;
  settings: AppSettings;
  onProcessingChange: (v: boolean) => void;
  onTaskCreated: (task: Task) => void;
  onTaskUpdated: (task: Task) => void;
  isNew: boolean;
}

interface ChatMessage {
  id: string;
  type: "user" | "agent" | "system";
  agentRole?: string;
  agentName?: string;
  emoji?: string;
  content: string;
  evidenceQuality?: EvidenceQuality;
  hasContradiction?: boolean;
}

const AGENT_EMOJIS: Record<string, string> = {
  manager: "🎯", researcher: "🔍", analyst: "📊",
  challenger: "⚖️", factchecker: "✅", review: "📋",
};

// ── STABLE SUB-COMPONENTS ─────────────────────────────────────────────────────

interface ModeToggleProps {
  responseMode: ResponseMode;
  onSetMode: (m: ResponseMode) => void;
}

const ModeToggle = memo(function ModeToggle({ responseMode, onSetMode }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-0.5">
      <button
        onClick={() => onSetMode("quick")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          responseMode === "quick" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <Zap size={11} />
        ตอบเร็ว
      </button>
      <button
        onClick={() => onSetMode("boardroom")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          responseMode === "boardroom" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <Building2 size={11} />
        บอร์ดรูม
      </button>
    </div>
  );
});

interface InputAreaProps {
  command: string;
  isRunning: boolean;
  needsClarification: boolean;
  responseMode: ResponseMode;
  avatarEmoji: string;
  placeholder: string;
  onSetMode: (m: ResponseMode) => void;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const InputArea = memo(function InputArea({
  command, isRunning, needsClarification, responseMode, avatarEmoji, placeholder,
  onSetMode, onChange, onKeyDown, onBlur, onSubmit, onCancel,
}: InputAreaProps) {
  return (
    <div
      className="flex-shrink-0 px-4 sm:px-6 pt-3 border-t border-gray-100"
      style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {needsClarification && (
        <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
          ❓ ผู้ประสานขอข้อมูลเพิ่มเติม — กรุณาพิมพ์คำตอบด้านล่าง
        </div>
      )}
      <div className="flex gap-2 items-end">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-xl mb-0.5">
          {avatarEmoji}
        </div>
        <div className="flex-1">
          <textarea
            value={command}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            placeholder={placeholder}
            rows={2}
            disabled={isRunning}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ maxHeight: "120px" }}
          />
        </div>
        {isRunning ? (
          <button
            onClick={onCancel}
            className="flex-shrink-0 w-11 h-11 bg-gray-200 hover:bg-red-100 hover:text-red-600 text-gray-500 rounded-2xl flex items-center justify-center transition-colors mb-0.5"
            title="หยุด"
          >
            <StopCircle size={16} />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={!command.trim()}
            className="flex-shrink-0 w-11 h-11 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center transition-colors shadow-sm mb-0.5"
          >
            <Send size={16} />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-400 hidden sm:block">Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่</p>
        <ModeToggle responseMode={responseMode} onSetMode={onSetMode} />
      </div>
    </div>
  );
});

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function BoardroomChat({
  task, profile, settings, onProcessingChange, onTaskCreated, onTaskUpdated, isNew,
}: BoardroomChatProps) {
  const [command, setCommand]                 = useState("");
  const [messages, setMessages]               = useState<ChatMessage[]>([]);
  const [thinking, setThinking]               = useState<{ agentRole: string; agentName: string; emoji: string } | null>(null);
  const [isRunning, setIsRunning]             = useState(false);
  const [showFeedback, setShowFeedback]       = useState(false);
  const [needsClarification, setNeedsClarification] = useState(false);
  const [isUserTyping, setIsUserTyping]       = useState(false);
  const [resumableError, setResumableError]   = useState<string | null>(null);
  const [copied, setCopied]                   = useState(false);
  const [animatedIds, setAnimatedIds]         = useState<Set<string>>(new Set());
  const [responseMode, setResponseMode]       = useState<ResponseMode>("quick");
  const [isRevisionCycle, setIsRevisionCycle] = useState(false);

  // ── Refs for stable logic (no stale-closure issues) ─────────────────────────
  const abortRef              = useRef<AbortController | null>(null);
  const bottomRef             = useRef<HTMLDivElement | null>(null);
  const typingTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgStepMapRef         = useRef<Record<string, AgentStep>>({});
  const currentTaskIdRef      = useRef<number | null>(null);
  const currentOptionsRef     = useRef<RunOptions | null>(null);
  const classifiedLevelRef    = useRef<0 | 1 | 2 | 3>(3);
  const responseModeRef       = useRef<ResponseMode>("quick");
  const onTypingCompleteRef   = useRef<(msgId: string, wasSkipped: boolean) => void>(() => {});

  // Revision-cycle tracking refs
  const isRevisionCycleRef    = useRef(false);
  const revisionRoundRef      = useRef(0);          // 0 = first run, 1 = revision
  const pendingRevisionRef    = useRef(false);       // set when factchecker signals REVISION_NEEDED
  const revisionContextRef    = useRef("");          // content to pass to researcher in revision

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); });
  }, []);

  const completedRoles = useMemo(
    () => [...new Set(messages.filter((m) => m.type === "agent").map((m) => m.agentRole!))],
    [messages]
  );

  const handleAgentClick = useCallback((role: string) => {
    const agentMsgs = messages.filter((m) => m.type === "agent" && m.agentRole === role);
    if (!agentMsgs.length) return;
    const last = agentMsgs[agentMsgs.length - 1];
    const el = document.getElementById(`msg-${last.id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [messages]);

  useEffect(() => { scrollToBottom(); }, [messages, thinking]);
  useEffect(() => { responseModeRef.current = responseMode; }, [responseMode]);

  // Reset state when task changes
  useEffect(() => {
    isRevisionCycleRef.current  = false;
    revisionRoundRef.current    = 0;
    pendingRevisionRef.current  = false;
    revisionContextRef.current  = "";
    setIsRevisionCycle(false);

    if (!task) {
      setMessages([]);
      setShowFeedback(false);
      setThinking(null);
      setIsRunning(false);
      setNeedsClarification(false);
      setIsUserTyping(false);
      setResumableError(null);
      setAnimatedIds(new Set());
      msgStepMapRef.current = {};
      return;
    }
    getTask(task.id).then((detail: TaskDetail) => {
      const msgs: ChatMessage[] = [
        { id: `user-${detail.id}`, type: "user", content: detail.userCommand },
        ...detail.discussions.map((d) => ({
          id: `log-${d.id}`,
          type: "agent" as const,
          agentRole: d.agentRole,
          agentName: d.senderAgent,
          emoji: settings.agentCustoms[d.agentRole as keyof typeof settings.agentCustoms]?.emoji
            ?? AGENT_EMOJIS[d.agentRole] ?? "🤖",
          content: d.message,
        })),
      ];
      setMessages(msgs);
      setShowFeedback(detail.status === "completed");
      setNeedsClarification(false);
      setResumableError(null);
    });
  }, [task?.id]);

  function showError(content: string, resumable = false) {
    setThinking(null);
    setIsRunning(false);
    onProcessingChange(false);
    setMessages((prev) => [...prev, { id: `err-${Date.now()}`, type: "system", content }]);
    if (resumable) setResumableError(content);
  }

  function buildRunOptions(clarificationNote?: string, revisionContext?: string, isRevision?: boolean, revisionRound?: number): RunOptions {
    return {
      agentCustoms: Object.fromEntries(
        Object.entries(settings.agentCustoms).map(([role, c]) => [role, { name: c.name, emoji: c.emoji }])
      ),
      systemPrompts: Object.fromEntries(
        Object.entries(settings.systemPrompts).map(([role, prompt]) => [role, prompt])
      ),
      clarificationNote,
      revisionContext,
      isRevision,
      revisionRound: revisionRound ?? 0,
    };
  }

  function getStepsAfterManager(level: 0 | 1 | 2 | 3): AgentStep[] {
    // "บอร์ดรูม" mode always uses the full council regardless of manager's classified level
    if (responseModeRef.current === "boardroom") return STEPS_FOR_LEVEL[3];
    return STEPS_FOR_LEVEL[level];
  }

  function makeStepHandler(step: AgentStep, taskId: number) {
    return (event: SSEEvent) => {
      if (event.type === "agent_thinking") {
        const role = event.agentRole!;
        const customEmoji = settings.agentCustoms[role as keyof typeof settings.agentCustoms]?.emoji;
        setThinking({
          agentRole: role,
          agentName: event.agentName!,
          emoji: customEmoji ?? event.emoji ?? AGENT_EMOJIS[role] ?? "🤖",
        });

      } else if (event.type === "message") {
        setThinking(null);
        const role = event.agentRole!;
        const customEmoji = settings.agentCustoms[role as keyof typeof settings.agentCustoms]?.emoji;
        const customName  = settings.agentCustoms[role as keyof typeof settings.agentCustoms]?.name;
        const newId = `msg-${Date.now()}-${Math.random()}`;
        msgStepMapRef.current[newId] = step;
        setAnimatedIds((prev) => new Set(prev).add(newId));
        setMessages((prev) => [...prev, {
          id: newId,
          type: "agent",
          agentRole: role,
          agentName: customName ?? event.agentName ?? "",
          emoji: customEmoji ?? event.emoji ?? AGENT_EMOJIS[role] ?? "🤖",
          content: event.message ?? "",
          evidenceQuality: event.evidenceQuality,
          hasContradiction: event.hasContradiction,
        }]);

      } else if (event.type === "needs_clarification") {
        setThinking(null);
        setNeedsClarification(true);
        setIsRunning(false);
        onProcessingChange(false);

      } else if (event.type === "summary") {
        setShowFeedback(true);

      } else if (event.type === "step_done") {
        if (step === "manager" && event.classifiedLevel !== undefined) {
          classifiedLevelRef.current = event.classifiedLevel;
        }

        // Architecture: LEVEL 0 → pipeline terminated by server — stop here
        if (step === "manager" && event.terminatePipeline) {
          classifiedLevelRef.current = 0;
        }

        // Mark pending revision when factchecker signals REVISION_NEEDED (within max rounds)
        if (step === "factchecker" && event.needsRevision && revisionRoundRef.current < 2) {
          pendingRevisionRef.current = true;
          // Context will be built in onTypingCompleteRef after the message is in state
        }

        if (event.isLast) {
          setThinking(null);
          setIsRunning(false);
          setResumableError(null);
          onProcessingChange(false);
          // Clean up revision state when pipeline is fully done
          isRevisionCycleRef.current = false;
          setIsRevisionCycle(false);
          getTask(taskId).then((d: TaskDetail) => onTaskUpdated(d));
        }

      } else if (event.type === "no_api_key") {
        showError("⚠️ ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
      } else if (event.type === "error") {
        showError(`❌ ${event.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่"}`, event.resumable === true);
      }
    };
  }

  async function startStep(step: AgentStep, taskId: number, options: RunOptions) {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    currentTaskIdRef.current = taskId;
    currentOptionsRef.current = options;
    try {
      await runStep(taskId, step, makeStepHandler(step, taskId), options, ctrl.signal);
    } catch {
      setIsRunning(false);
      onProcessingChange(false);
    }
  }

  // ── Typing-complete sequencer ─────────────────────────────────────────────
  // Reassigned on every render — always captures latest state
  onTypingCompleteRef.current = (msgId: string, wasSkipped: boolean) => {
    const step = msgStepMapRef.current[msgId];
    if (!step) return;
    const taskId  = currentTaskIdRef.current;
    const options = currentOptionsRef.current;
    if (taskId == null || !options) return;

    const delayMs = wasSkipped ? 0 : 1500;

    // ── 1. Revision cycle sequencing (researcher → analyst → review) ──────────
    if (isRevisionCycleRef.current) {
      if (step === "researcher") {
        setTimeout(() => startStep("analyst", taskId, options), delayMs);
        return;
      }
      if (step === "analyst") {
        const revOpts = { ...options, isRevision: true };
        currentOptionsRef.current = revOpts;
        setTimeout(() => startStep("review", taskId, revOpts), delayMs);
        return;
      }
      // "review" is isLast → handled by makeStepHandler step_done
      return;
    }

    // ── 2. Pending revision trigger (after factchecker typing completes) ───────
    if (pendingRevisionRef.current && step === "factchecker") {
      pendingRevisionRef.current  = false;
      revisionRoundRef.current    = 1;
      isRevisionCycleRef.current  = true;
      setIsRevisionCycle(true);

      // Build revision context from the latest challenger + factchecker messages
      const challengerContent = messages
        .filter((m) => m.agentRole === "challenger")
        .slice(-1)[0]?.content ?? "";
      const factcheckerContent = messages
        .filter((m) => m.agentRole === "factchecker")
        .slice(-1)[0]?.content ?? "";
      const revCtx = [
        challengerContent ? `[จุดอ่อนจากผู้ท้าทาย]:\n${challengerContent.slice(0, 400)}` : "",
        factcheckerContent ? `[ข้อผิดพลาดจากผู้ตรวจสอบ]:\n${factcheckerContent.slice(0, 400)}` : "",
      ].filter(Boolean).join("\n\n");
      revisionContextRef.current = revCtx;

      // Insert orange system message
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-revision-${Date.now()}`,
          type: "system" as const,
          content: "🔄 ตรวจพบจุดบอดสำคัญ — กำลังส่งกลับทีมวิจัยเพื่อแก้ไข...",
        },
      ]);

      const revOpts = buildRunOptions(undefined, revCtx, true, revisionRoundRef.current);
      currentOptionsRef.current = revOpts;
      setTimeout(() => startStep("researcher", taskId, revOpts), delayMs);
      return;
    }

    // ── 3. Normal flow sequencing ─────────────────────────────────────────────
    if (step === "manager") {
      const level       = classifiedLevelRef.current;
      const followSteps = getStepsAfterManager(level);
      if (followSteps.length === 0) {
        setIsRunning(false);
        onProcessingChange(false);
        return;
      }
      setTimeout(() => startStep(followSteps[0], taskId, options), delayMs);
      return;
    }

    const level        = classifiedLevelRef.current;
    const plannedSteps: AgentStep[] = ["manager", ...getStepsAfterManager(level)];
    const idx          = plannedSteps.indexOf(step);

    if (idx < 0 || idx >= plannedSteps.length - 1) {
      setIsRunning(false);
      onProcessingChange(false);
      return;
    }

    const nextStep = plannedSteps[idx + 1];
    setTimeout(() => startStep(nextStep, taskId, options), delayMs);
  };

  // ── Stable callbacks ───────────────────────────────────────────────────────

  const handleCommandChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommand(e.target.value);
    setIsUserTyping(e.target.value.length > 0);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (e.target.value.length > 0) {
      typingTimerRef.current = setTimeout(() => setIsUserTyping(false), 2000);
    }
  }, []);

  const handleBlur   = useCallback(() => setIsUserTyping(false), []);
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setThinking(null);
    setIsRunning(false);
    onProcessingChange(false);
  }, [onProcessingChange]);

  const handleSubmitRef = useRef<() => Promise<void>>(async () => {});
  handleSubmitRef.current = async () => {
    const text = command.trim();
    if (!text || isRunning) return;

    setCommand("");
    setIsUserTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    // Reset all state for a fresh run
    setThinking(null);
    setShowFeedback(false);
    setResumableError(null);
    msgStepMapRef.current       = {};
    isRevisionCycleRef.current  = false;
    revisionRoundRef.current    = 0;
    pendingRevisionRef.current  = false;
    revisionContextRef.current  = "";
    setIsRevisionCycle(false);

    if (needsClarification && task) {
      setNeedsClarification(false);
      setMessages((prev) => [...prev, { id: `user-clarify-${Date.now()}`, type: "user", content: text }]);
      setIsRunning(true);
      onProcessingChange(true);
      await startStep("manager", task.id, buildRunOptions(text));
      return;
    }

    if (task && !isNew) {
      setMessages((prev) => [...prev, { id: `user-followup-${Date.now()}`, type: "user", content: text }]);
      setIsRunning(true);
      onProcessingChange(true);
      classifiedLevelRef.current = 3;
      await startStep("manager", task.id, buildRunOptions(text));
      return;
    }

    setMessages([{ id: `user-new-${Date.now()}`, type: "user", content: text }]);
    classifiedLevelRef.current = 3;

    let currentTask: Task;
    try {
      currentTask = await createTask(text);
    } catch {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`, type: "system",
        content: "❌ ไม่สามารถสร้างคำถามได้ กรุณาลองใหม่",
      }]);
      return;
    }
    onTaskCreated(currentTask);
    setIsRunning(true);
    onProcessingChange(true);
    await startStep("manager", currentTask.id, buildRunOptions());
  };

  const handleSubmit  = useCallback(() => { handleSubmitRef.current(); }, []);
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitRef.current(); }
  }, []);

  async function handleResume() {
    if (!task || isRunning) return;
    setResumableError(null);
    msgStepMapRef.current      = {};
    classifiedLevelRef.current = 3;

    let nextStep: AgentStep = "manager";
    try {
      const detail  = await getTask(task.id);
      const doneRoles = new Set(detail.discussions.map((d) => d.agentRole));
      nextStep = STEP_ORDER.find((s) => !doneRoles.has(s)) ?? "manager";
    } catch {}

    setIsRunning(true);
    onProcessingChange(true);
    await startStep(nextStep, task.id, buildRunOptions());
  }

  function handleCopyReport() {
    const agentMessages = messages.filter((m) => m.type === "agent");
    if (agentMessages.length === 0) return;
    const date = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const SECTION: Record<string, string> = {
      manager: "🎯 กรอบการวิเคราะห์",  researcher: "🔍 ข้อมูลและหลักฐาน",
      analyst: "📊 การวิเคราะห์",       challenger: "⚖️ ความเสี่ยงและข้อโต้แย้ง",
      factchecker: "✅ ตรวจสอบข้อเท็จจริง", review: "📋 Executive Summary",
    };
    const lines: string[] = [
      "═══════════════════════════════════════",
      "  AI Boardroom — สรุปผลการวิเคราะห์",
      "═══════════════════════════════════════",
      `วาระ: ${task?.userCommand ?? ""}`,
      `วันที่: ${date}`,
      "",
    ];
    agentMessages.forEach((m) => {
      const section = SECTION[m.agentRole ?? ""] ?? m.agentRole ?? "";
      const qual    = m.evidenceQuality ? ` [${m.evidenceQuality}]` : "";
      lines.push(`── ${m.emoji} ${m.agentName} — ${section}${qual} ──`);
      lines.push(m.content);
      lines.push("");
    });
    lines.push("═══════════════════════════════════════");
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function handleFeedbackSubmitted() {
    setShowFeedback(false);
    if (task) { const detail = await getTask(task.id); onTaskUpdated(detail); }
  }

  const inputPlaceholder = needsClarification
    ? "พิมพ์ข้อมูลเพิ่มเติม..."
    : profile
    ? `${profile.displayName} ต้องการถามหรือวิเคราะห์อะไร?`
    : "พิมพ์ข้อความ...";

  const avatarEmoji = profile?.avatarEmoji ?? "👤";

  // ── WELCOME SCREEN ─────────────────────────────────────────────────────────
  if (!task && !isNew) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto py-6 px-4">
          {/* War Room — hero element */}
          <div className="flex-shrink-0">
            <WarRoomLayout
              profile={profile}
              customs={settings.agentCustoms}
              thinkingRole={null}
              completedRoles={[]}
              isUserTyping={isUserTyping}
              needsClarification={false}
              isRevisionCycle={false}
              compact={false}
            />
          </div>

          <div className="mt-5 text-center max-w-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
              {profile ? `ยินดีต้อนรับ, ${profile.displayName}` : "AI Boardroom"}
            </h2>
            {profile && (
              <p className="text-xs text-gray-400 mb-2">{profile.role}</p>
            )}
            <p className="text-sm text-gray-400 mb-2">
              Multi-agent AI ที่ช่วยค้นข้อมูล วิเคราะห์ เปรียบเทียบ และช่วยตัดสินใจ
            </p>
            <div className="flex items-center justify-center gap-3 text-xs text-gray-300">
              <span className="flex items-center gap-1">
                <Zap size={10} className="text-blue-400" />
                <span><strong className="text-gray-500">ตอบเร็ว</strong> = ค้นข้อมูล</span>
              </span>
              <span className="text-gray-200">·</span>
              <span className="flex items-center gap-1">
                <Building2 size={10} className="text-indigo-400" />
                <span><strong className="text-gray-500">บอร์ดรูม</strong> = วิเคราะห์เต็มทีม 6 คน พร้อม Review Loop</span>
              </span>
            </div>
          </div>
        </div>

        <InputArea
          command={command}
          isRunning={isRunning}
          needsClarification={needsClarification}
          responseMode={responseMode}
          avatarEmoji={avatarEmoji}
          placeholder={inputPlaceholder}
          onSetMode={setResponseMode}
          onChange={handleCommandChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  // ── CHAT SCREEN ────────────────────────────────────────────────────────────

  const latestAgentId = messages.filter((m) => m.type === "agent").slice(-1)[0]?.id ?? null;
  const hasAgentMessages = messages.some((m) => m.type === "agent");

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Compact War Room status bar */}
      <WarRoomLayout
        profile={profile}
        customs={settings.agentCustoms}
        thinkingRole={thinking?.agentRole ?? null}
        completedRoles={completedRoles}
        isUserTyping={isUserTyping}
        needsClarification={needsClarification}
        isRevisionCycle={isRevisionCycle}
        onAgentClick={handleAgentClick}
        compact={true}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {messages.map((msg) => {
          if (msg.type === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[80%] bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-3 text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            );
          }

          if (msg.type === "system") {
            const isRevisionMsg = msg.content.includes("🔄");
            return (
              <div key={msg.id} className="flex justify-center">
                <div className={`text-xs px-4 py-2 rounded-xl text-center max-w-xs ${
                  isRevisionMsg
                    ? "bg-orange-50 text-orange-700 border border-orange-200 font-medium"
                    : "bg-gray-50 text-gray-500 border border-gray-100"
                }`}>
                  {msg.content}
                </div>
              </div>
            );
          }

          // agent message
          const isLatest  = msg.id === latestAgentId;
          const doAnimate = animatedIds.has(msg.id);

          return (
            <div id={`msg-${msg.id}`} key={msg.id}>
              <AgentMessage
                emoji={msg.emoji ?? "🤖"}
                agentName={msg.agentName ?? ""}
                agentRole={msg.agentRole ?? ""}
                message={msg.content}
                isLatest={isLatest}
                animate={doAnimate}
                evidenceQuality={msg.evidenceQuality}
                hasContradiction={msg.hasContradiction}
                onTypingComplete={doAnimate ? (wasSkipped) => {
                  setAnimatedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(msg.id);
                    return next;
                  });
                  onTypingCompleteRef.current(msg.id, wasSkipped);
                } : undefined}
              />
            </div>
          );
        })}

        {/* Thinking indicator */}
        {thinking && (
          <TypingIndicator
            emoji={thinking.emoji}
            agentName={thinking.agentName}
            agentRole={thinking.agentRole}
          />
        )}

        {/* Resumable error */}
        {resumableError && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
            <span className="text-amber-600 text-sm flex-1">{resumableError}</span>
            <button
              onClick={handleResume}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-xs font-medium transition-colors"
            >
              <RotateCcw size={12} />
              ลองใหม่
            </button>
          </div>
        )}

        {/* Feedback + copy report */}
        {showFeedback && task && (
          <div className="space-y-2">
            {hasAgentMessages && (
              <div className="flex justify-end">
                <button
                  onClick={handleCopyReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  {copied ? <ClipboardCheck size={12} className="text-green-500" /> : <ClipboardCopy size={12} />}
                  {copied ? "คัดลอกแล้ว!" : "คัดลอกรายงาน"}
                </button>
              </div>
            )}
            <FeedbackBox taskId={task.id} onFeedbackSubmitted={handleFeedbackSubmitted} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <InputArea
        command={command}
        isRunning={isRunning}
        needsClarification={needsClarification}
        responseMode={responseMode}
        avatarEmoji={avatarEmoji}
        placeholder={inputPlaceholder}
        onSetMode={setResponseMode}
        onChange={handleCommandChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
