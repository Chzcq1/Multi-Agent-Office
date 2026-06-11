import { Router } from "express";
import { db, tasksTable, discussionLogsTable, finalSummariesTable, agentsTable, userProfilesTable } from "@workspace/db";
import { eq, desc, asc, and } from "drizzle-orm";

const router = Router();

const GITHUB_MODELS_BASE = "https://models.inference.ai.azure.com";
const MODEL = "gpt-4o-mini";
const MAX_TOKENS = 1800;
const CTX_LIMIT = 700;
const MAX_REVISION_ROUNDS = 2;

type CognitiveLevel = 0 | 1 | 2 | 3;

interface AgentCustom { name: string; emoji: string; }
interface AgentCustomsMap { [role: string]: AgentCustom; }

interface AgentDef {
  key: string;
  name: string;
  emoji: string;
  role: string;
  department: string;
  buildPrompt: (userName: string, userRole: string) => string;
}

const DEFAULT_CUSTOMS: AgentCustomsMap = {
  manager:     { name: "ผู้ประสาน",    emoji: "🎯" },
  researcher:  { name: "นักวิจัย",     emoji: "🔍" },
  analyst:     { name: "นักวิเคราะห์", emoji: "📊" },
  challenger:  { name: "ผู้ท้าทาย",   emoji: "⚖️" },
  factchecker: { name: "ผู้ตรวจสอบ",  emoji: "✅" },
  review:      { name: "ผู้สรุป",      emoji: "📋" },
};

// ── Global Platform Identity ───────────────────────────────────────────────────
const PLATFORM_IDENTITY = `
[PLATFORM CONTEXT — อ่านทุกครั้ง]
คุณกำลังทำงานอยู่บนแพลตฟอร์ม "AI Boardroom ของคุณเชน"
- แพลตฟอร์มนี้พัฒนาโดย Simbiote Intelligence
- วัตถุประสงค์: Multi-agent reasoning และ collaborative strategic analysis
- ทีมประกอบด้วย 6 AI agents ที่คิดอิสระจากกัน: ผู้ประสาน, นักวิจัย, นักวิเคราะห์, ผู้ท้าทาย, ผู้ตรวจสอบ, ผู้สรุป
- ต่างจาก ChatGPT: แต่ละ agent วิเคราะห์จากมุมมองของตัวเองโดยไม่รับอิทธิพลจาก agent อื่น
- ผู้ใช้งานหลักคือ "คุณเชน" (หัวหน้าฝ่ายปฏิบัติการ)
`;

function buildAgents(userName: string, userRole: string, customs?: AgentCustomsMap): AgentDef[] {
  const c = customs ?? DEFAULT_CUSTOMS;
  const m  = { ...DEFAULT_CUSTOMS.manager,     ...(c.manager ?? {}) };
  const r  = { ...DEFAULT_CUSTOMS.researcher,  ...(c.researcher ?? {}) };
  const a  = { ...DEFAULT_CUSTOMS.analyst,     ...(c.analyst ?? {}) };
  const ch = { ...DEFAULT_CUSTOMS.challenger,  ...(c.challenger ?? {}) };
  const fc = { ...DEFAULT_CUSTOMS.factchecker, ...(c.factchecker ?? {}) };
  const rv = { ...DEFAULT_CUSTOMS.review,      ...(c.review ?? {}) };

  const address = `คุณกำลังรายงานต่อ ${userName} (${userRole})`;

  return [
    {
      key: "manager", name: m.name, emoji: m.emoji, role: "manager", department: "ประสานงาน",
      buildPrompt: () => `คุณคือ ${m.name} (Coordinator / Gatekeeper) ของ AI Boardroom
${PLATFORM_IDENTITY}
${address}

บุคลิก: กระชับ ตรง เป็นประโยชน์ ไม่พูดพล่าม

═══ ARCHITECTURE RULE (บังคับเสมอ) ═══
คุณเป็น Gatekeeper ของ Pipeline ทั้งหมด
1. ประเมิน input ก่อนเสมอ
2. ถ้าเป็น Small Talk / ทักทาย / ถามระบบ → ตอบเองแล้ว TERMINATE PIPELINE ทันที
3. ถ้าเป็นงานจริง → ส่งต่อ Boardroom Loop พร้อมระบุ LEVEL

ระดับการตอบ:
LEVEL 0 (สังคม/ข้อมูลระบบ): สวัสดี ขอบคุณ ถามว่าทำอะไรได้ เป็นใคร → ตอบเองทันที ห้ามเกิน 120 คำ → TERMINATE
LEVEL 1 (ตอบเร็ว): คำถามง่าย ข้อมูลทั่วไป → ส่งนักวิจัย 1 คน ห้ามเกิน 300 คำ
LEVEL 2 (วิเคราะห์): เปรียบเทียบ ประเมิน ตัดสินใจ → ส่งทีม 3 คน ห้ามเกิน 800 คำ
LEVEL 3 (กลยุทธ์): กลยุทธ์ธุรกิจ การลงทุน ซับซ้อน → ส่งทีมทั้งหมด ไม่จำกัด

กฎเหล็ก:
- LEVEL 0: ตอบเองเลย ห้ามส่งทีม ลงท้าย TERMINATE_PIPELINE: true
- LEVEL 1-3: ลงท้าย TERMINATE_PIPELINE: false
- ถ้าต้องถามเพิ่ม: NEEDS_CLARIFICATION: true
- ถ้าไม่ต้องถาม: NEEDS_CLARIFICATION: false
- ลงท้ายด้วย LEVEL: <0|1|2|3>

ตอบภาษาไทยเท่านั้น`,
    },
    {
      key: "researcher", name: r.name, emoji: r.emoji, role: "researcher", department: "วิจัย",
      buildPrompt: () => `คุณคือ ${r.name} (Researcher) ของ AI Boardroom — Round 1: Drafting Phase
${PLATFORM_IDENTITY}
${address}

บุคลิก: ข้อเท็จจริงเป็นหลัก กระตือรือร้น ตรงประเด็น

═══ STRICT WINDOW CONTEXT (บังคับ) ═══
- รับเฉพาะ: [System Prompt นี้] + [คำถามล่าสุดของผู้ใช้] + [Task Summary จาก Coordinator]
- ห้ามรับ: ประวัติการสนทนาก่อนหน้า, ผลลัพธ์จาก turn อื่น, ข้อมูลนอก context นี้
- วิเคราะห์อิสระ 100% — Context Isolation Enforced

กฎเนื้อหา:
- ใช้ข้อมูลจริงที่รู้เท่านั้น ห้ามประดิษฐ์ตัวเลขหรือชื่อสมมติ
- อ้างอิงข้อมูลปี 2024-2026 เมื่อเกี่ยวข้อง
- นำเสนอข้อเท็จจริงสำหรับ Draft V1

ลงท้ายด้วย:
EVIDENCE_QUALITY: มีหลักฐานรองรับ หรือ รองรับบางส่วน หรือ เป็นการคาดเดา
CONFIDENCE_NUM: <0-100>

ตอบภาษาไทยเท่านั้น กระชับ`,
    },
    {
      key: "analyst", name: a.name, emoji: a.emoji, role: "analyst", department: "วิเคราะห์",
      buildPrompt: () => `คุณคือ ${a.name} (Analyst) ของ AI Boardroom — Round 1: Drafting Phase
${PLATFORM_IDENTITY}
${address}

บุคลิก: มีเหตุผล ชั่งน้ำหนัก อธิบาย tradeoffs อย่างชัดเจน

═══ STRICT WINDOW CONTEXT (บังคับ) ═══
- รับเฉพาะ: [System Prompt นี้] + [คำถามล่าสุด] + [ข้อมูลจาก${r.name}]
- ห้ามรับ: output จาก${ch.name}, ${fc.name}, ${rv.name} หรือ turn อื่น
- ประเมินด้วยตัวเองเสมอ ห้ามเห็นด้วยโดยอัตโนมัติ

วิเคราะห์ strengths / weaknesses / risks / ROI ตรงๆ
ผลลัพธ์ของคุณจะรวมกับ${r.name} เป็น "Draft Report V1"

ลงท้ายด้วย:
EVIDENCE_QUALITY: มีหลักฐานรองรับ หรือ รองรับบางส่วน หรือ เป็นการคาดเดา
CONFIDENCE_NUM: <0-100>

ตอบภาษาไทยเท่านั้น กระชับ`,
    },
    {
      key: "challenger", name: ch.name, emoji: ch.emoji, role: "challenger", department: "ท้าทาย",
      buildPrompt: () => `คุณคือ ${ch.name} (Devil's Advocate) ของ AI Boardroom — Round 2: Critique Phase
${PLATFORM_IDENTITY}
${address}

บุคลิก: ช่างสงสัย คมคาย แต่สุภาพ โจมตีแนวคิดไม่ใช่คน

═══ STRICT WINDOW CONTEXT (บังคับ) ═══
- รับเฉพาะ: [System Prompt นี้] + [คำถามล่าสุด] + [Draft Report V1 จาก Round 1]
- Draft V1 = ผลรวมของ${r.name} + ${a.name}
- ห้ามรับ: output จาก${fc.name}, ${rv.name} หรือ turn อื่น

หน้าที่ใน Round 2:
- ค้นหา blindspots, จุดอ่อน, และความเสี่ยงร้ายแรงใน Draft V1
- ต้องหาข้อโต้แย้งอย่างน้อย 1 ข้อ ห้ามเห็นด้วย 100%
- ชี้ failure scenarios ที่คนอื่นมองข้าม

การตัดสิน FATAL FLAW:
- REVISION_NEEDED: true = พบ Fatal Flaw ร้ายแรง (ข้อเท็จจริงผิดพลาด, ความเสี่ยง deal-breaker, ข้อมูลขัดแย้งรุนแรง)
- REVISION_NEEDED: false = ข้อกังวลมีแต่ไม่ถึงขั้น Fatal

ลงท้ายด้วย:
EVIDENCE_QUALITY: มีหลักฐานรองรับ หรือ รองรับบางส่วน หรือ เป็นการคาดเดา
CONFIDENCE_NUM: <0-100>
REVISION_NEEDED: true หรือ false

ตอบภาษาไทยเท่านั้น กระชับ`,
    },
    {
      key: "factchecker", name: fc.name, emoji: fc.emoji, role: "factchecker", department: "ตรวจสอบ",
      buildPrompt: () => `คุณคือ ${fc.name} (Auditor) ของ AI Boardroom — Round 2: Critique Phase
${PLATFORM_IDENTITY}
${address}

บุคลิก: แม่นยำ กระชับ โฟกัสการตรวจสอบข้อเท็จจริง

═══ STRICT WINDOW CONTEXT (บังคับ) ═══
- รับเฉพาะ: [System Prompt นี้] + [Draft Report V1] + [ข้อกังวลจาก${ch.name}]
- Draft V1 = ผลรวมของ${r.name} + ${a.name}
- ห้ามรับ: output จาก${rv.name} หรือ turn อื่น

หน้าที่ใน Round 2:
- จำแนกแต่ละข้ออ้างใน Draft V1: ✅ ยืนยันได้ / ⚠️ ยืนยันได้บางส่วน / ❌ ไม่มีหลักฐาน
- พิจารณาข้อกังวลของ${ch.name} — ถ้า Fatal Flaw ยืนยันได้ → REVISION_NEEDED: true
- ห้ามสร้างแหล่งอ้างอิงเท็จ ถ้าไม่แน่ใจ → "ไม่สามารถยืนยันได้"

REVISION_NEEDED: true = เห็นด้วยกับ Fatal Flaw ของ${ch.name} หรือพบปัญหาร้ายแรงเอง
REVISION_NEEDED: false = ข้อผิดพลาดเล็กน้อยหรือไม่มีเลย → APPROVED

ลงท้ายด้วย:
EVIDENCE_QUALITY: มีหลักฐานรองรับ หรือ รองรับบางส่วน หรือ เป็นการคาดเดา
CONFIDENCE_NUM: <0-100>
REVISION_NEEDED: true หรือ false

ตอบภาษาไทยเท่านั้น กระชับ`,
    },
    {
      key: "review", name: rv.name, emoji: rv.emoji, role: "review", department: "สรุป",
      buildPrompt: () => `คุณคือ ${rv.name} (Executive Summarizer) ของ AI Boardroom — Final Output Processing
${PLATFORM_IDENTITY}
${address}

บุคลิก: มุ่งเน้นผลลัพธ์ที่ใช้งานได้จริง สำหรับผู้บริหาร

═══ STRICT WINDOW CONTEXT (บังคับ) ═══
- รับเฉพาะ: [System Prompt นี้] + [Draft V1 ที่ผ่านการ Critique แล้ว] + [ผลการตรวจสอบ Round 2]
- สถานะ: APPROVED — Draft V1 ผ่านการ Critique แล้ว ไม่มี Fatal Flaw

หน้าที่ — Final Output Processing:
สร้าง Executive Summary แบ่งเป็น 2 ส่วนชัดเจน:

**🔴 Devil's Advocate**
- ระบุจุดอ่อน ความเสี่ยง และข้อโต้แย้งสำคัญที่ยังเปิดอยู่ (2-3 ข้อ)
- เป็นกลาง ตรงไปตรงมา ไม่เว้นวรรคความเป็นจริง

**✅ Executive Summary — สำหรับ ${userName}**
- ข้อสรุปหลักที่ควรรู้ (2-3 ข้อ)
- คำแนะนำที่ดำเนินการได้ทันที (Next Steps)
- ระบุ ⚠️ พบความขัดแย้ง ถ้าทีมมีความเห็นไม่ตรงกันอย่างมีนัยสำคัญ

ห้ามสร้างรายงานยาว ห้ามพูดซ้ำ agent อื่นแบบคำต่อคำ
โฟกัสที่ "ทำอะไรต่อ" ไม่ใช่ "สรุปว่าอะไร"

ลงท้ายด้วย:
EVIDENCE_QUALITY: มีหลักฐานรองรับ หรือ รองรับบางส่วน หรือ เป็นการคาดเดา
CONFIDENCE_NUM: <0-100>

ตอบภาษาไทยเท่านั้น`,
    },
  ];
}

async function getActiveUserProfile() {
  const [profile] = await db.select().from(userProfilesTable).limit(1);
  return profile ?? null;
}

async function ensureDefaultAgents() {
  const existing = await db.select().from(agentsTable);
  if (existing.length < 6) {
    const agents = buildAgents("ผู้ใช้", "ผู้บริหาร");
    const existingRoles = new Set((existing as Array<{ role: string }>).map(({ role }) => role));
    for (const a of agents) {
      if (!existingRoles.has(a.role)) {
        await db.insert(agentsTable).values({
          name: a.name, role: a.role, status: "idle", avatar: a.emoji,
          department: a.department, customPrompt: null,
        });
      }
    }
  }
}

function truncate(text: string, limit = CTX_LIMIT): string {
  return text.length <= limit ? text : text.slice(0, limit) + "…";
}

function extractConfidenceNum(text: string): number {
  const m = text.match(/CONFIDENCE_NUM[:\s]*(\d+)/i);
  if (m) return Math.min(100, Math.max(0, parseInt(m[1])));
  const old = text.match(/CONFIDENCE[:\s]*(\d+)/i);
  if (old) return Math.min(100, Math.max(0, parseInt(old[1])));
  return 70;
}

function extractEvidenceQuality(text: string): string | undefined {
  if (text.includes("มีหลักฐานรองรับ")) return "มีหลักฐานรองรับ";
  if (text.includes("รองรับบางส่วน")) return "รองรับบางส่วน";
  if (text.includes("เป็นการคาดเดา")) return "เป็นการคาดเดา";
  return undefined;
}

function extractLevel(text: string): CognitiveLevel {
  const m = text.match(/LEVEL[:\s]*([0-3])/i);
  if (!m) return 3;
  return parseInt(m[1]) as CognitiveLevel;
}

function extractRevisionNeeded(text: string): boolean {
  const m = text.match(/REVISION_NEEDED[:\s]*(true|false)/i);
  return m ? m[1].toLowerCase() === "true" : false;
}

function extractTerminatePipeline(text: string): boolean {
  const m = text.match(/TERMINATE_PIPELINE[:\s]*(true|false)/i);
  if (m) return m[1].toLowerCase() === "true";
  // Fallback: LEVEL 0 always terminates
  return extractLevel(text) === 0;
}

function isResumableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("429") || msg.includes("503") || msg.includes("500") ||
    msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Service Unavailable") ||
    msg.includes("UNAVAILABLE") || msg.includes("overloaded") ||
    msg.includes("rate limit") || msg.includes("Rate limit")
  );
}

async function callAgent(systemPrompt: string, userMessage: string): Promise<string> {
  // Support both new and legacy env var names
  const githubToken = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!githubToken) throw new Error("GITHUB_TOKEN is not configured on the server");

  const response = await fetch(`${GITHUB_MODELS_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${githubToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage },
      ],
      max_tokens: MAX_TOKENS,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from GitHub Models");
  return content;
}

async function saveLog(taskId: number, senderAgent: string, agentRole: string, message: string) {
  await db
    .delete(discussionLogsTable)
    .where(and(eq(discussionLogsTable.taskId, taskId), eq(discussionLogsTable.agentRole, agentRole)));
  await db.insert(discussionLogsTable).values({ taskId, senderAgent, agentRole, message });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

router.get("/tasks", async (_req, res) => {
  await ensureDefaultAgents();
  const tasks = await db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt));
  res.json(tasks);
});

router.post("/tasks", async (req, res) => {
  const { userCommand } = req.body;
  if (!userCommand?.trim()) return res.status(400).json({ error: "userCommand is required" });
  await ensureDefaultAgents();
  const [task] = await db
    .insert(tasksTable)
    .values({ userCommand: userCommand.trim(), status: "pending" })
    .returning();
  res.status(201).json(task);
});

router.get("/tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!task) return res.status(404).json({ error: "Task not found" });
  const discussions = await db
    .select().from(discussionLogsTable)
    .where(eq(discussionLogsTable.taskId, id))
    .orderBy(asc(discussionLogsTable.createdAt));
  const [summary] = await db.select().from(finalSummariesTable).where(eq(finalSummariesTable.taskId, id));
  res.json({ ...task, discussions, summary: summary ?? null });
});

router.delete("/tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(finalSummariesTable).where(eq(finalSummariesTable.taskId, id));
  await db.delete(discussionLogsTable).where(eq(discussionLogsTable.taskId, id));
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.status(204).end();
});

// ── SINGLE-STEP SSE ENDPOINT ──────────────────────────────────────────────────
router.post("/tasks/:id/run-step", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const {
    step,
    agentCustoms,
    systemPrompts,
    clarificationNote,
    isRevision,
    revisionContext,
    revisionRound,   // 0-based revision count passed from frontend
  } = req.body;

  const VALID_STEPS = ["manager", "researcher", "analyst", "challenger", "factchecker", "review"];
  if (!VALID_STEPS.includes(step)) return res.status(400).json({ error: "Invalid step" });

  // Check for API token (support both env var names)
  if (!process.env.GITHUB_TOKEN && !process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    res.status(500).json({ error: "GITHUB_TOKEN is not configured — add it in Vercel Environment Variables" });
    return;
  }

  // ── Enforce max revision limit server-side ────────────────────────────────
  const currentRevisionRound = typeof revisionRound === "number" ? revisionRound : 0;
  if (isRevision && step === "researcher" && currentRevisionRound >= MAX_REVISION_ROUNDS) {
    res.status(400).json({ error: `Maximum revision rounds (${MAX_REVISION_ROUNDS}) reached. Routing to final summary.` });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  function send(data: object) { res.write(`data: ${JSON.stringify(data)}\n\n`); }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!task) { send({ type: "error", error: "Task not found" }); res.end(); return; }

  try {
    const profile = await getActiveUserProfile();
    const userName = profile?.displayName ?? "คุณเชน";
    const userRole  = profile?.role ?? "ผู้บริหาร";
    const AGENTS = buildAgents(userName, userRole, agentCustoms);
    const [, researcher, analyst, challenger, factchecker, review] = AGENTS;
    const userCommand = task.userCommand;

    // ── DATABASE REFRESH: flush state on new task start ───────────────────────
    // Per architecture: "Reset State on New Task — Flush/Clear previous answers of Agents 2-6"
    if (step === "manager" && !isRevision) {
      await db.delete(discussionLogsTable).where(eq(discussionLogsTable.taskId, id));
      await db.delete(finalSummariesTable).where(eq(finalSummariesTable.taskId, id));
    }

    // ── Load current task logs (strict window — only this task) ───────────────
    const existingLogs = await db
      .select().from(discussionLogsTable)
      .where(eq(discussionLogsTable.taskId, id))
      .orderBy(asc(discussionLogsTable.createdAt));
    const logsByRole = Object.fromEntries(
      (existingLogs as Array<{ agentRole: string; message: string }>)
        .map((l) => [l.agentRole, l.message] as [string, string])
    );

    await db.update(tasksTable)
      .set({ status: "discussing", updatedAt: new Date() })
      .where(eq(tasksTable.id, id));

    const agentDef = AGENTS.find(a => a.role === step)!;
    send({ type: "agent_thinking", agentRole: agentDef.role, agentName: agentDef.name, emoji: agentDef.emoji });

    // ── INJECT STRICT WINDOW CONTEXT per agent role ───────────────────────────
    // Architecture: "Package Payload: Only current System Prompt + current Prompt + Coordinator Summary"
    let userMessage: string;

    if (step === "manager") {
      // Coordinator / Gatekeeper — receives only the raw user input
      userMessage = clarificationNote
        ? `ข้อความเดิม: "${userCommand}"\nข้อมูลเพิ่มเติม: ${clarificationNote}\nดำเนินการต่อเลย ระบุ NEEDS_CLARIFICATION: false, TERMINATE_PIPELINE: false และ LEVEL ที่เหมาะสม`
        : `ข้อความจาก ${userName}: "${userCommand}"`;

    } else if (step === "researcher") {
      // Round 1 — Researcher sees only: current question + coordinator summary + revision note
      const coordinatorSummary = logsByRole["manager"]
        ? `\n\n[Task Summary จาก Coordinator]:\n${truncate(logsByRole["manager"], 300)}`
        : "";
      const revisionNote = isRevision && revisionContext
        ? `\n\n[REVISION ROUND ${currentRevisionRound + 1}/${MAX_REVISION_ROUNDS}]: พบปัญหาร้ายแรงใน Draft V1:\n${truncate(revisionContext, 400)}\nกรุณาปรับปรุงข้อมูลให้แก้ไขประเด็นเหล่านี้`
        : "";
      userMessage = `คำถาม/งาน: "${userCommand}"${coordinatorSummary}${revisionNote}\n\nนำเสนอข้อมูลที่เกี่ยวข้องและเชื่อถือได้สำหรับ Draft V1 พร้อม EVIDENCE_QUALITY และ CONFIDENCE_NUM`;

    } else if (step === "analyst") {
      // Round 1 — Analyst sees: question + coordinator summary + researcher data only
      const coordinatorSummary = logsByRole["manager"]
        ? `\n\n[Task Summary จาก Coordinator]:\n${truncate(logsByRole["manager"], 200)}`
        : "";
      const researcherData = logsByRole[researcher.role]
        ? `\n\n[ข้อมูลจาก${researcher.name} — Round 1]:\n${truncate(logsByRole[researcher.role])}`
        : "";
      userMessage = `คำถาม/งาน: "${userCommand}"${coordinatorSummary}${researcherData}\n\nวิเคราะห์ความเป็นไปได้ tradeoffs และ ROI สำหรับ Draft V1 พร้อม EVIDENCE_QUALITY และ CONFIDENCE_NUM`;

    } else if (step === "challenger") {
      // Round 2 — Devil's Advocate receives Draft V1 (researcher + analyst combined)
      const draftV1 = [
        logsByRole[researcher.role]  ? `[${researcher.name} — ข้อมูล]:\n${truncate(logsByRole[researcher.role])}` : "",
        logsByRole[analyst.role]     ? `[${analyst.name} — การวิเคราะห์]:\n${truncate(logsByRole[analyst.role])}` : "",
      ].filter(Boolean).join("\n\n");
      userMessage = `คำถาม/งาน: "${userCommand}"\n\n═══ DRAFT REPORT V1 (Round 1 Output) ═══\n${draftV1}\n\nค้นหา Fatal Flaws, blindspots, และความเสี่ยงร้ายแรงใน Draft V1 นี้ พร้อม EVIDENCE_QUALITY, CONFIDENCE_NUM และ REVISION_NEEDED`;

    } else if (step === "factchecker") {
      // Round 2 — Auditor receives Draft V1 + challenger's critique
      const draftV1 = [
        logsByRole[researcher.role]  ? `[${researcher.name}]:\n${truncate(logsByRole[researcher.role])}` : "",
        logsByRole[analyst.role]     ? `[${analyst.name}]:\n${truncate(logsByRole[analyst.role])}` : "",
      ].filter(Boolean).join("\n\n");
      const challengerCritique = logsByRole[challenger.role]
        ? `\n\n═══ CRITIQUE จาก${challenger.name} (Devil's Advocate) ═══\n${truncate(logsByRole[challenger.role])}`
        : "";
      const challengerRevision = extractRevisionNeeded(logsByRole[challenger.role] ?? "");
      const revisionHint = challengerRevision
        ? "\n\n[⚠️ ALERT]: ผู้ท้าทายพบ Fatal Flaw — กรุณาตรวจสอบและยืนยัน REVISION_NEEDED อย่างรอบคอบ"
        : "";
      userMessage = `ตรวจสอบ Draft V1 ต่อไปนี้:\n\n═══ DRAFT REPORT V1 ═══\n${draftV1}${challengerCritique}${revisionHint}\n\nจำแนก ✅/⚠️/❌ พร้อม EVIDENCE_QUALITY, CONFIDENCE_NUM และ REVISION_NEEDED (STATUS: APPROVED หรือ REVISION_NEEDED)`;

    } else {
      // Final Output Processing — Executive Summarizer receives full approved draft
      const draftV1 = [
        logsByRole[researcher.role]  ? `[${researcher.name}]:\n${truncate(logsByRole[researcher.role], 500)}` : "",
        logsByRole[analyst.role]     ? `[${analyst.name}]:\n${truncate(logsByRole[analyst.role], 500)}` : "",
      ].filter(Boolean).join("\n\n");
      const critiques = [
        logsByRole[challenger.role]  ? `[${challenger.name} — Devil's Advocate]:\n${truncate(logsByRole[challenger.role], 400)}` : "",
        logsByRole[factchecker.role] ? `[${factchecker.name} — Auditor]:\n${truncate(logsByRole[factchecker.role], 400)}` : "",
      ].filter(Boolean).join("\n\n");
      const revisionNote = isRevision ? `\n\n[✅ รอบที่ ${currentRevisionRound + 1} — หลังแก้ไข Draft V1 แล้ว]` : "";
      userMessage = `สร้าง Executive Summary สำหรับ ${userName}:${revisionNote}\n\n═══ APPROVED DRAFT V1 ═══\n${draftV1}\n\n═══ ROUND 2 CRITIQUE RESULTS ═══\n${critiques}\n\nแบ่งเป็น 2 ส่วน: 🔴 Devil's Advocate และ ✅ Executive Summary`;
    }

    const customSystemPrompt = (systemPrompts as Record<string, string> | null)?.[step];
    const resolvedSystemPrompt = customSystemPrompt?.trim()
      ? customSystemPrompt.trim()
      : agentDef.buildPrompt(userName, userRole);

    const agentMsg = await callAgent(resolvedSystemPrompt, userMessage);
    await saveLog(id, agentDef.name, agentDef.role, agentMsg);

    const confidenceNum = extractConfidenceNum(agentMsg);
    const evidenceQuality = extractEvidenceQuality(agentMsg);
    let classifiedLevel: CognitiveLevel | undefined;
    let needsRevision = false;
    let terminatePipeline = false;

    if (step === "manager") {
      classifiedLevel = extractLevel(agentMsg);
      // Architecture: LEVEL 0 = small talk → TERMINATE PIPELINE immediately
      terminatePipeline = extractTerminatePipeline(agentMsg);
    }

    // Round 2 result: combine challenger + factchecker REVISION_NEEDED signals
    // Only flag revision if under the max limit
    if (step === "factchecker") {
      const challengerRevision = extractRevisionNeeded(logsByRole[challenger.role] ?? "");
      const factcheckerRevision = extractRevisionNeeded(agentMsg);
      const hasFatalFlaw = challengerRevision || factcheckerRevision;
      // Enforce max revision rounds — if limit reached, force APPROVED
      needsRevision = hasFatalFlaw && currentRevisionRound < MAX_REVISION_ROUNDS;
    }

    send({
      type: "message",
      agentRole: agentDef.role,
      agentName: agentDef.name,
      emoji: agentDef.emoji,
      message: agentMsg,
      confidenceNum,
      evidenceQuality,
    });

    // ── Manager: check for clarification needed ───────────────────────────────
    if (step === "manager" && !clarificationNote && agentMsg.includes("NEEDS_CLARIFICATION: true")) {
      await db.update(tasksTable)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(tasksTable.id, id));
      send({ type: "needs_clarification" });
      send({ type: "step_done", step, isLast: false, needsClarification: true, terminatePipeline: false });
      res.end();
      return;
    }

    // ── Manager: LEVEL 0 → terminate pipeline immediately ────────────────────
    if (step === "manager" && terminatePipeline) {
      await db.update(tasksTable)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(tasksTable.id, id));
      // Save coordinator's direct reply as the final summary
      await db.delete(finalSummariesTable).where(eq(finalSummariesTable.taskId, id));
      const [savedSummary] = await db
        .insert(finalSummariesTable)
        .values({ taskId: id, summaryText: agentMsg })
        .returning();
      send({ type: "summary", summary: savedSummary });
      send({ type: "step_done", step, isLast: true, terminatePipeline: true, classifiedLevel });
      res.end();
      return;
    }

    const isLast = step === "review";

    if (isLast) {
      await db.delete(finalSummariesTable).where(eq(finalSummariesTable.taskId, id));
      const [savedSummary] = await db
        .insert(finalSummariesTable)
        .values({ taskId: id, summaryText: agentMsg })
        .returning();
      await db.update(tasksTable)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(tasksTable.id, id));
      send({ type: "summary", summary: savedSummary });
    }

    send({ type: "step_done", step, isLast, needsRevision, classifiedLevel, terminatePipeline: false });
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resumable = isResumableError(err);
    send({ type: "error", error: resumable ? `⏳ ${msg} — ระบบจะลองใหม่อัตโนมัติ` : msg, resumable });
    res.end();
  }
});

// ── FEEDBACK ──────────────────────────────────────────────────────────────────
router.patch("/tasks/:id/feedback", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { feedback, note } = req.body;
  const VALID = ["approved", "rejected", "revision_requested"];
  if (!VALID.includes(feedback)) return res.status(400).json({ error: "Invalid feedback" });
  const [task] = await db
    .update(tasksTable)
    .set({ status: feedback, updatedAt: new Date() })
    .where(eq(tasksTable.id, id))
    .returning();
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (note) {
    await db.update(finalSummariesTable)
      .set({ feedbackNote: note })
      .where(eq(finalSummariesTable.taskId, id));
  }
  res.json(task);
});

export default router;
