const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

// ── localStorage profile cache ──────────────────────────────────────────────
const PROFILE_LS_KEY = "boardroom_profile_v1";

function lsGetProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_LS_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function lsSaveProfile(p: UserProfile) {
  try {
    localStorage.setItem(PROFILE_LS_KEY, JSON.stringify(p));
  } catch {}
}

export interface UserProfile {
  id: number;
  displayName: string;
  role: string;
  avatarEmoji: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  userCommand: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionLog {
  id: number;
  taskId: number;
  senderAgent: string;
  agentRole: string;
  message: string;
  createdAt: string;
}

export interface FinalSummary {
  id: number;
  taskId: number;
  summaryText: string;
  userFeedback: string | null;
  feedbackNote: string | null;
  createdAt: string;
}

export interface TaskDetail extends Task {
  discussions: DiscussionLog[];
  summary: FinalSummary | null;
}

export async function getProfile(): Promise<UserProfile | null> {
  const local = lsGetProfile();
  try {
    const r = await fetch(`${BASE}/profile`);
    if (r.status === 404) {
      if (local) {
        fetch(`${BASE}/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: local.displayName, role: local.role, avatarEmoji: local.avatarEmoji }),
        })
          .then((res) => res.json())
          .then((saved) => lsSaveProfile(saved as UserProfile))
          .catch(() => {});
      }
      return local;
    }
    if (!r.ok) return local;
    const profile = (await r.json()) as UserProfile;
    lsSaveProfile(profile);
    return profile;
  } catch {
    return local;
  }
}

export async function saveProfile(data: {
  displayName: string;
  role: string;
  avatarEmoji: string;
}): Promise<UserProfile> {
  const optimistic: UserProfile = {
    id: 0,
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  lsSaveProfile(optimistic);
  try {
    const r = await fetch(`${BASE}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) {
      const saved = (await r.json()) as UserProfile;
      lsSaveProfile(saved);
      return saved;
    }
  } catch {}
  return optimistic;
}

export async function listTasks(): Promise<Task[]> {
  const r = await fetch(`${BASE}/tasks`);
  if (!r.ok) throw new Error("Failed to fetch tasks");
  return r.json();
}

export async function createTask(userCommand: string): Promise<Task> {
  const r = await fetch(`${BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userCommand }),
  });
  if (!r.ok) throw new Error("Failed to create task");
  return r.json();
}

export async function getTask(id: number): Promise<TaskDetail> {
  const r = await fetch(`${BASE}/tasks/${id}`);
  if (!r.ok) throw new Error("Failed to fetch task");
  return r.json();
}

export async function deleteTask(id: number): Promise<void> {
  const r = await fetch(`${BASE}/tasks/${id}`, { method: "DELETE" });
  if (!r.ok && r.status !== 204) throw new Error("Failed to delete task");
}

export async function submitFeedback(
  id: number,
  feedback: "approved" | "rejected" | "revision_requested",
  note?: string
): Promise<Task> {
  const r = await fetch(`${BASE}/tasks/${id}/feedback`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback, note: note ?? null }),
  });
  if (!r.ok) throw new Error("Failed to submit feedback");
  return r.json();
}

export type EvidenceQuality = "มีหลักฐานรองรับ" | "รองรับบางส่วน" | "เป็นการคาดเดา";

export interface SSEEvent {
  type: string;
  agentRole?: string;
  agentName?: string;
  emoji?: string;
  message?: string;
  summary?: FinalSummary;
  error?: string;
  retryDelay?: number;
  resumable?: boolean;
  step?: string;
  isLast?: boolean;
  needsClarification?: boolean;
  // Cognitive budget + evidence quality
  confidenceNum?: number;
  evidenceQuality?: EvidenceQuality;
  classifiedLevel?: 0 | 1 | 2 | 3;
  needsRevision?: boolean;
  hasContradiction?: boolean;
  // Architecture: LEVEL 0 pipeline termination
  terminatePipeline?: boolean;
}

export interface RunOptions {
  agentCustoms?: Record<string, { name: string; emoji: string }>;
  systemPrompts?: Record<string, string>;
  clarificationNote?: string;
  isRevision?: boolean;
  revisionContext?: string;
  revisionRound?: number;
}

export type AgentStep = "manager" | "researcher" | "analyst" | "challenger" | "factchecker" | "review";
export const STEP_ORDER: AgentStep[] = ["manager", "researcher", "analyst", "challenger", "factchecker", "review"];

// Steps per cognitive level (manager always first, then these follow)
export const STEPS_FOR_LEVEL: Record<0 | 1 | 2 | 3, AgentStep[]> = {
  0: [],                                                          // manager only
  1: ["researcher"],                                              // manager + researcher
  2: ["researcher", "analyst", "challenger"],                     // no factchecker/review
  3: ["researcher", "analyst", "challenger", "factchecker", "review"], // full boardroom
};

// ── Single-step SSE runner — frontend drives the sequencing ──────────────────
export function runStep(
  id: number,
  step: AgentStep,
  onEvent: (e: SSEEvent) => void,
  options?: RunOptions,
  signal?: AbortSignal
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(`${BASE}/tasks/${id}/run-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step,
          agentCustoms: options?.agentCustoms ?? null,
          systemPrompts: options?.systemPrompts ?? null,
          clarificationNote: options?.clarificationNote ?? null,
          isRevision: options?.isRevision ?? false,
          revisionContext: options?.revisionContext ?? null,
          revisionRound: options?.revisionRound ?? 0,
        }),
        signal,
      });

      if (!response.ok) { reject(new Error("Failed to start step")); return; }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as SSEEvent;
              onEvent(data);
              if (data.type === "step_done" || data.type === "error" || data.type === "no_api_key") {
                resolve();
                return;
              }
            } catch {}
          }
        }
      }
      resolve();
    } catch (err) {
      if ((err as Error).name === "AbortError") resolve();
      else reject(err);
    }
  });
}
