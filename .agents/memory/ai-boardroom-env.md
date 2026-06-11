---
  name: AI Boardroom env vars
  description: Which environment variables are required vs optional for the AI Boardroom app
  ---

  ## Required
  - GITHUB_TOKEN (or GITHUB_PERSONAL_ACCESS_TOKEN): GitHub Models API key for GPT-4o-mini — all 6 AI agents use this

  ## Optional  
  - GEMINI_API_KEY (or AI_INTEGRATIONS_GEMINI_API_KEY): Gemini chat route only
  - CORS_ORIGIN: comma-separated allowed origins for CORS (defaults to allow-all)
  - SESSION_SECRET: not currently used in session middleware

  ## Database
  - DATABASE_URL: Replit manages this automatically; on Supabase use Transaction Pooler port 6543 with SSL

  **Why:** Without GITHUB_TOKEN the run-step endpoint returns 500 and all AI agents fail silently on the frontend.
  