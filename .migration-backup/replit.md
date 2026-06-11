# AI Strategic Boardroom

Multi-agent AI strategic analysis platform — a Thai-language "War Room" where 6 AI agents (coordinator, researcher, analyst, challenger, fact-checker, reviewer) collaboratively analyze strategic questions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `GITHUB_TOKEN` — GitHub Models API key (used by the multi-agent pipeline via gpt-4o-mini)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Vite + React + Tailwind CSS v4 + shadcn/ui (at `artifacts/ai-boardroom/`)
- API: Express 5 (at `artifacts/api-server/`)
- DB: PostgreSQL + Drizzle ORM
- AI: GitHub Models API (gpt-4o-mini) for agent reasoning
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ai-boardroom/src/` — frontend React app
- `artifacts/ai-boardroom/src/lib/api.ts` — frontend API client + SSE runner
- `artifacts/ai-boardroom/src/lib/settings.ts` — app settings (agent names, custom prompts, Gemini key)
- `artifacts/api-server/src/routes/tasks.ts` — main multi-agent pipeline (SSE-based)
- `artifacts/api-server/src/routes/` — all API routes
- `lib/db/src/schema/` — Drizzle schema (tasks, agents, userProfiles, discussionLogs, finalSummaries)
- `lib/integrations/gemini-ai/` — Gemini AI integration lib
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)

## Architecture decisions

- Frontend drives the agent sequencing step-by-step via SSE; each step is a separate POST to `/api/tasks/:id/run-step`
- Context isolation: each agent only sees specific prior agents' outputs (not all previous messages)
- Cognitive level system: manager agent classifies 0-3 complexity, determining which agents run
- Profile stored in both DB and localStorage (resilient to DB errors on first load)
- Uses GitHub Models API (gpt-4o-mini) for agent calls — requires `GITHUB_TOKEN` env var

## Product

AI Strategic Boardroom (ห้องประชุมกลยุทธ์ AI): Users enter a strategic question or task in Thai. The platform runs it through 6 AI agents that independently analyze from different angles (research, analysis, challenge, fact-check, synthesis) and produce an executive summary with Devil's Advocate section.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `GITHUB_TOKEN` must be set for the agent pipeline to work (used for GitHub Models API)
- DB tables must be pushed before the API works: `pnpm --filter @workspace/db run push`
- The migration backup at `.migration-backup/` is the original project — do not delete it

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
