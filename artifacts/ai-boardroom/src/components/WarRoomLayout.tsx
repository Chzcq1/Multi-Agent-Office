import { memo } from "react";
import { UserProfile } from "../lib/api";
import { AgentCustoms, DEFAULT_CUSTOMS } from "../lib/settings";

type AgentRole = "manager" | "researcher" | "analyst" | "challenger" | "factchecker" | "review";

const AGENT_ORDER: AgentRole[] = ["manager", "researcher", "analyst", "challenger", "factchecker", "review"];

// ── Full War Room Geometry ────────────────────────────────────────────────────
const W = 340;
const H = 310;
const CX = 170;
const CY = 155;

// Precomputed hex positions (radius = 108px from center)
const POS: Record<AgentRole, { x: number; y: number }> = {
  manager:     { x: 170, y: 47  },   // top        (−90°)
  researcher:  { x: 264, y: 101 },   // top-right  (−30°)
  analyst:     { x: 264, y: 209 },   // bot-right  (+30°)
  challenger:  { x: 170, y: 263 },   // bottom     (+90°)
  factchecker: { x: 76,  y: 209 },   // bot-left   (+150°)
  review:      { x: 76,  y: 101 },   // top-left   (−150°)
};

// Normal pipeline connections
const CONNECTIONS: [AgentRole, AgentRole][] = [
  ["manager",     "researcher"],
  ["researcher",  "analyst"],
  ["analyst",     "challenger"],
  ["challenger",  "factchecker"],
  ["factchecker", "review"],
];

// Predecessor in normal flow (for determining which connection is "active")
const PREV: Partial<Record<AgentRole, AgentRole>> = {
  researcher:  "manager",
  analyst:     "researcher",
  challenger:  "analyst",
  factchecker: "challenger",
  review:      "factchecker",
};

export interface WarRoomLayoutProps {
  profile: UserProfile | null;
  customs: AgentCustoms;
  thinkingRole: string | null;
  completedRoles: string[];
  standbyRoles?: string[];
  isUserTyping: boolean;
  needsClarification: boolean;
  isRevisionCycle?: boolean;
  onAgentClick?: (role: string) => void;
  compact?: boolean;
}

export default memo(function WarRoomLayout({
  profile,
  customs,
  thinkingRole,
  completedRoles,
  isUserTyping,
  needsClarification,
  isRevisionCycle = false,
  onAgentClick,
  compact = false,
}: WarRoomLayoutProps) {
  const c = customs ?? DEFAULT_CUSTOMS;
  const thinking = thinkingRole as AgentRole | null;

  // Revision arc: active when in revision cycle and researcher is thinking
  // (shows backward arc from factchecker/challenger → researcher)
  const isRevArc = isRevisionCycle && thinking === "researcher" && completedRoles.length >= 4;

  const activeFrom: AgentRole | null = (thinking && !isRevArc) ? (PREV[thinking] ?? null) : null;
  const activeTo:   AgentRole | null = (thinking && !isRevArc) ? thinking : null;

  // ── COMPACT MODE (horizontal status bar during chat) ─────────────────────
  if (compact) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        background: "#0a1628",
        borderBottom: "1px solid #1e293b",
        padding: "5px 10px",
        overflowX: "auto",
        flexShrink: 0,
      }}>
        {AGENT_ORDER.map((role) => {
          const agent = c[role];
          const isActive = thinking === role;
          const isDone   = completedRoles.includes(role);
          const isRevTgt = isRevisionCycle && role === "researcher" && isActive;
          const isRevSrc = isRevArc && (role === "factchecker" || role === "challenger");
          const isClarify = role === "manager" && needsClarification;

          const dotColor =
            isActive && isRevTgt ? "#fb923c"
            : isActive           ? "#38bdf8"
            : isClarify          ? "#facc15"
            : isRevSrc           ? "#fb923c"
            : isDone             ? "#22c55e"
            : "#334155";

          const labelColor =
            isActive && isRevTgt ? "#fed7aa"
            : isActive           ? "#7dd3fc"
            : isRevSrc           ? "#fb923c"
            : isDone             ? "#86efac"
            : "#475569";

          return (
            <button
              key={role}
              onClick={() => isDone && onAgentClick?.(role)}
              disabled={!isDone}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 10,
                border: "none",
                background: isActive
                  ? (isRevTgt ? "rgba(251,146,60,0.12)" : "rgba(56,189,248,0.10)")
                  : "transparent",
                cursor: isDone ? "pointer" : "default",
                boxShadow: isActive
                  ? (isRevTgt
                      ? "0 0 8px rgba(251,146,60,0.5)"
                      : "0 0 8px rgba(56,189,248,0.4)")
                  : undefined,
                transition: "all 0.3s",
                flexShrink: 0,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: dotColor,
                  boxShadow: isActive ? `0 0 5px ${dotColor}` : undefined,
                  animation: isActive ? "cwDotPulse 1.2s ease-in-out infinite" : undefined,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 14 }}>{agent.emoji}</span>
              <span style={{
                fontSize: 10,
                color: labelColor,
                fontWeight: isActive ? 600 : 400,
                whiteSpace: "nowrap",
              }}>
                {agent.name}
              </span>
              {isActive && (
                <span style={{
                  fontSize: 8,
                  color: isRevTgt ? "#fb923c" : "#38bdf8",
                  animation: "cwDotPulse 1s ease-in-out infinite",
                }}>●</span>
              )}
            </button>
          );
        })}

        {/* Revision label */}
        {isRevArc && (
          <span style={{
            marginLeft: 8,
            fontSize: 10,
            color: "#fb923c",
            fontWeight: 600,
            whiteSpace: "nowrap",
            animation: "cwDotPulse 1.5s ease-in-out infinite",
          }}>
            🔄 ตีกลับแก้ไข
          </span>
        )}

        <style>{`
          @keyframes cwDotPulse {
            0%,100%{opacity:1}50%{opacity:0.35}
          }
        `}</style>
      </div>
    );
  }

  // ── FULL WAR ROOM MODE ────────────────────────────────────────────────────
  const NODE = 54;

  return (
    <div style={{
      position: "relative",
      width: W,
      height: H,
      background: "radial-gradient(ellipse at 50% 45%, #0f2040 0%, #060e1c 70%)",
      borderRadius: 20,
      overflow: "hidden",
      flexShrink: 0,
      userSelect: "none",
    }}>

      {/* Grid dots background */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.07) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        pointerEvents: "none",
      }} />

      {/* SVG layer — connections + deco ring */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        {/* Decorative dashed outer ring */}
        <circle
          cx={CX} cy={CY} r={112}
          fill="none"
          stroke="#1e3a5f"
          strokeWidth={1}
          strokeDasharray="4 10"
        />

        {/* Normal flow connections */}
        {CONNECTIONS.map(([from, to]) => {
          const p1 = POS[from];
          const p2 = POS[to];
          const isActive  = activeFrom === from && activeTo === to;
          const fromDone  = completedRoles.includes(from);
          const toDone    = completedRoles.includes(to);
          const bothDone  = fromDone && toDone;
          // Hide factchecker→review when revision arc is showing
          if (isRevArc && from === "factchecker" && to === "review") return null;

          return (
            <g key={`${from}-${to}`}>
              {/* Base line */}
              <line
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={bothDone ? "#22c55e" : "#1e3a5f"}
                strokeWidth={1.5}
                strokeOpacity={bothDone ? 0.45 : 0.7}
              />
              {/* Animated dash on active connection */}
              {isActive && (
                <line
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  strokeDasharray="10 8"
                  style={{ animation: "wrLineDash 0.7s linear infinite" }}
                />
              )}
            </g>
          );
        })}

        {/* Revision backward arc: factchecker → researcher (orange, curved over top) */}
        {isRevArc && (
          <g>
            <path
              d={`M ${POS.factchecker.x} ${POS.factchecker.y} Q ${CX} 0 ${POS.researcher.x} ${POS.researcher.y}`}
              fill="none"
              stroke="#fb923c"
              strokeWidth={2}
              strokeOpacity={0.5}
            />
            <path
              d={`M ${POS.factchecker.x} ${POS.factchecker.y} Q ${CX} 0 ${POS.researcher.x} ${POS.researcher.y}`}
              fill="none"
              stroke="#fed7aa"
              strokeWidth={2.5}
              strokeDasharray="10 8"
              style={{ animation: "wrLineDash 0.7s linear infinite reverse" }}
            />
          </g>
        )}

        {/* Center halo */}
        <circle
          cx={CX} cy={CY} r={34}
          fill="rgba(6,14,28,0.85)"
          stroke={isUserTyping ? "#38bdf8" : "#1e3a5f"}
          strokeWidth={2}
          style={{
            filter: isUserTyping ? "drop-shadow(0 0 10px rgba(56,189,248,0.7))" : undefined,
          }}
        />
      </svg>

      {/* Center — user avatar */}
      <div style={{
        position: "absolute",
        left: CX - 27,
        top: CY - 32,
        width: 54,
        height: 54,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 6,
      }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>
          {profile?.avatarEmoji ?? "👤"}
        </span>
        <span style={{
          fontSize: 7.5,
          color: "#64748b",
          marginTop: 2,
          maxWidth: 52,
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {profile?.displayName?.split(" ")[0] ?? "คุณ"}
        </span>
      </div>

      {/* Agent nodes */}
      {AGENT_ORDER.map((role) => {
        const pos   = POS[role];
        const agent = c[role];
        const isActive  = thinking === role;
        const isDone    = completedRoles.includes(role);
        const isRevTgt  = isRevisionCycle && role === "researcher" && isActive;
        const isRevSrc  = isRevArc && (role === "factchecker" || role === "challenger");
        const isClarify = role === "manager" && needsClarification;

        let border = "#1e3a5f";
        let bg     = "rgba(15,32,64,0.92)";
        let glow: string | undefined;
        let textColor = "#475569";
        let anim: string | undefined;

        if (isActive) {
          if (isRevTgt) {
            border = "#fb923c";
            bg     = "rgba(251,146,60,0.14)";
            glow   = "0 0 22px rgba(251,146,60,0.75), 0 0 44px rgba(251,146,60,0.3)";
            textColor = "#fed7aa";
            anim   = "wrOrangePulse 1.5s ease-in-out infinite";
          } else {
            border = "#38bdf8";
            bg     = "rgba(56,189,248,0.12)";
            glow   = "0 0 22px rgba(56,189,248,0.75), 0 0 44px rgba(56,189,248,0.3)";
            textColor = "#7dd3fc";
            anim   = "wrBluePulse 1.5s ease-in-out infinite";
          }
        } else if (isClarify) {
          border = "#facc15";
          bg     = "rgba(250,204,21,0.1)";
          glow   = "0 0 14px rgba(250,204,21,0.6)";
          textColor = "#fef08a";
          anim   = "wrBluePulse 1.5s ease-in-out infinite";
        } else if (isRevSrc) {
          border = "#fb923c";
          bg     = "rgba(251,146,60,0.08)";
          textColor = "#fb923c";
        } else if (isDone) {
          border = "#22c55e";
          bg     = "rgba(34,197,94,0.09)";
          textColor = "#86efac";
        }

        return (
          <button
            key={role}
            onClick={() => isDone && onAgentClick?.(role)}
            disabled={!isDone}
            style={{
              position: "absolute",
              left:  pos.x - NODE / 2,
              top:   pos.y - NODE / 2,
              width: NODE,
              height: NODE,
              borderRadius: "50%",
              border: `2px solid ${border}`,
              background: bg,
              boxShadow: glow,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: isDone ? "pointer" : "default",
              transition: "border-color 0.3s, background 0.3s",
              WebkitTapHighlightColor: "transparent",
              animation: anim,
              zIndex: 5,
              outline: "none",
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{agent.emoji}</span>
            <span style={{
              fontSize: 7.5,
              color: textColor,
              marginTop: 2,
              maxWidth: 50,
              textAlign: "center",
              lineHeight: 1.15,
              overflow: "hidden",
              transition: "color 0.3s",
            }}>
              {agent.name}
            </span>

            {/* Active pulse indicator */}
            {isActive && (
              <div style={{
                position: "absolute",
                top: -5,
                right: -5,
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: isRevTgt ? "#fb923c" : "#38bdf8",
                border: "2px solid #060e1c",
                animation: "wrDotPing 1s ease-in-out infinite",
              }} />
            )}

            {/* Done checkmark */}
            {isDone && !isActive && (
              <div style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 15,
                height: 15,
                borderRadius: "50%",
                background: "#22c55e",
                border: "2px solid #060e1c",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 7,
                color: "#fff",
                fontWeight: "bold",
                lineHeight: 1,
              }}>✓</div>
            )}
          </button>
        );
      })}

      {/* Status label */}
      {(thinking || isRevArc) && (
        <div style={{
          position: "absolute",
          bottom: 10,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.02em",
          color: isRevArc ? "#fb923c" : "#38bdf8",
          textShadow: isRevArc
            ? "0 0 12px rgba(251,146,60,0.6)"
            : "0 0 12px rgba(56,189,248,0.6)",
          pointerEvents: "none",
        }}>
          {isRevArc
            ? "🔄 ตีกลับแก้ไข — ส่งให้ทีมวิจัยรอบใหม่"
            : thinking
            ? `${c[thinking as AgentRole]?.name ?? thinking} กำลังวิเคราะห์...`
            : ""}
        </div>
      )}

      {/* Branding */}
      <div style={{
        position: "absolute",
        top: 9,
        right: 12,
        fontSize: 8.5,
        color: "#1e3a5f",
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        fontWeight: 700,
        pointerEvents: "none",
      }}>
        AI BOARDROOM
      </div>

      <style>{`
        @keyframes wrBluePulse {
          0%,100%{box-shadow:0 0 12px rgba(56,189,248,0.5),0 0 24px rgba(56,189,248,0.2)}
          50%{box-shadow:0 0 30px rgba(56,189,248,0.95),0 0 55px rgba(56,189,248,0.4)}
        }
        @keyframes wrOrangePulse {
          0%,100%{box-shadow:0 0 12px rgba(251,146,60,0.5),0 0 24px rgba(251,146,60,0.2)}
          50%{box-shadow:0 0 30px rgba(251,146,60,0.95),0 0 55px rgba(251,146,60,0.4)}
        }
        @keyframes wrDotPing {
          0%,100%{transform:scale(1);opacity:1}
          50%{transform:scale(1.6);opacity:0.5}
        }
        @keyframes wrLineDash {
          from{stroke-dashoffset:0}
          to{stroke-dashoffset:-36}
        }
      `}</style>
    </div>
  );
});
