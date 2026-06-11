export interface AgentCustom {
  name: string;
  emoji: string;
}

export interface AgentCustoms {
  manager: AgentCustom;
  researcher: AgentCustom;
  analyst: AgentCustom;
  challenger: AgentCustom;
  factchecker: AgentCustom;
  review: AgentCustom;
}

export interface SystemPrompts {
  manager: string;
  researcher: string;
  analyst: string;
  challenger: string;
  factchecker: string;
  review: string;
}

export interface AppSettings {
  agentCustoms: AgentCustoms;
  systemPrompts: SystemPrompts;
  geminiKey?: string;
}

export const DEFAULT_CUSTOMS: AgentCustoms = {
  manager:     { name: "ผู้ประสาน",    emoji: "🎯" },
  researcher:  { name: "นักวิจัย",     emoji: "🔍" },
  analyst:     { name: "นักวิเคราะห์", emoji: "📊" },
  challenger:  { name: "ผู้ท้าทาย",   emoji: "⚖️" },
  factchecker: { name: "ผู้ตรวจสอบ",  emoji: "✅" },
  review:      { name: "ผู้สรุป",      emoji: "📋" },
};

export const DEFAULT_SYSTEM_PROMPTS: SystemPrompts = {
  manager:     "",
  researcher:  "",
  analyst:     "",
  challenger:  "",
  factchecker: "",
  review:      "",
};

const LS_KEY_SETTINGS = "boardroom_settings_v4";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(LS_KEY_SETTINGS);
    if (!raw) return { agentCustoms: DEFAULT_CUSTOMS, systemPrompts: DEFAULT_SYSTEM_PROMPTS };
    const parsed = JSON.parse(raw);
    return {
      agentCustoms: {
        manager:     { ...DEFAULT_CUSTOMS.manager,     ...parsed.agentCustoms?.manager },
        researcher:  { ...DEFAULT_CUSTOMS.researcher,  ...parsed.agentCustoms?.researcher },
        analyst:     { ...DEFAULT_CUSTOMS.analyst,     ...parsed.agentCustoms?.analyst },
        challenger:  { ...DEFAULT_CUSTOMS.challenger,  ...parsed.agentCustoms?.challenger },
        factchecker: { ...DEFAULT_CUSTOMS.factchecker, ...parsed.agentCustoms?.factchecker },
        review:      { ...DEFAULT_CUSTOMS.review,      ...parsed.agentCustoms?.review },
      },
      systemPrompts: {
        manager:     parsed.systemPrompts?.manager     ?? "",
        researcher:  parsed.systemPrompts?.researcher  ?? "",
        analyst:     parsed.systemPrompts?.analyst     ?? "",
        challenger:  parsed.systemPrompts?.challenger  ?? "",
        factchecker: parsed.systemPrompts?.factchecker ?? "",
        review:      parsed.systemPrompts?.review      ?? "",
      },
      geminiKey: parsed.geminiKey,
    };
  } catch {
    return { agentCustoms: DEFAULT_CUSTOMS, systemPrompts: DEFAULT_SYSTEM_PROMPTS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(settings));
}

export function resetSettings(): AppSettings {
  const defaults: AppSettings = { agentCustoms: DEFAULT_CUSTOMS, systemPrompts: DEFAULT_SYSTEM_PROMPTS };
  saveSettings(defaults);
  return defaults;
}
