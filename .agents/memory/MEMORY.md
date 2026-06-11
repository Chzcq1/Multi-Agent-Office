- [AI Boardroom env vars](ai-boardroom-env.md) — GITHUB_TOKEN is required for AI agents; GEMINI_API_KEY optional for Gemini chat route
  - [Vercel deployment setup](vercel-deployment.md) — Express on Vercel needs api/index.ts handler + vercel.json; PORT env var must NOT be required
  - [Drizzle migrations path](drizzle-migrations-path.md) — migrations must be copied to dist/migrations/ during esbuild build; path detection via import.meta.url
  