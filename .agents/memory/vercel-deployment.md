---
  name: Vercel deployment setup
  description: How to deploy this Express+Vite monorepo to Vercel
  ---

  ## Architecture
  - Frontend: Vite build → artifacts/ai-boardroom/dist/public/
  - API: Express wrapped as serverless function at artifacts/api-server/api/index.ts
  - vercel.json at project root routes /api/* to the serverless handler

  ## Key rules
  1. Express index.ts throws if PORT is missing — Vercel doesn't set PORT. The Vercel entry point (api/index.ts) bypasses index.ts entirely and just calls app(req, res) directly.
  2. Migrations must run in api/index.ts (lazy, once per cold start) not in index.ts
  3. CORS_ORIGIN env var should be set to the Vercel frontend domain

  **Why:** Express servers can't listen on a port in Vercel serverless — they must export a handler function.
  