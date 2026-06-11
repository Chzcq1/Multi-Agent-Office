import { Router } from "express";

const router = Router();

// ── Credits API ────────────────────────────────────────────────────────────────
// These routes are stubs that work with Supabase when configured.
// On Replit (no Supabase), they return a graceful "not configured" response.
// On Vercel + Supabase, they call the @workspace/supabase library.

function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// GET /api/credits/:userId — fetch credit balance for a user
router.get("/credits/:userId", async (req, res) => {
  if (!isSupabaseConfigured()) {
    return res.json({ enabled: false, message: "Supabase not configured — credits unavailable in Replit mode" });
  }
  try {
    const { getCredits } = await import("@workspace/supabase");
    const credits = await getCredits(req.params.userId);
    if (!credits) return res.status(404).json({ error: "User not found" });
    res.json({ enabled: true, ...credits });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/credits/ensure — create credits row for new user (called after sign-up)
router.post("/credits/ensure", async (req, res) => {
  if (!isSupabaseConfigured()) {
    return res.json({ enabled: false, message: "Supabase not configured" });
  }
  const { userId, email, displayName } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  try {
    const { ensureCreditsRow } = await import("@workspace/supabase");
    const credits = await ensureCreditsRow(userId, email, displayName);
    res.status(201).json({ enabled: true, ...credits });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/credits/deduct — deduct credits for a task run
router.post("/credits/deduct", async (req, res) => {
  if (!isSupabaseConfigured()) {
    return res.json({ enabled: false, success: true, remainingCredits: null });
  }
  const { userId, amount, taskId, description } = req.body;
  if (!userId || typeof amount !== "number") {
    return res.status(400).json({ error: "userId and amount are required" });
  }
  try {
    const { deductCredits } = await import("@workspace/supabase");
    const result = await deductCredits(userId, amount, taskId, description);
    res.json({ enabled: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/credits/add — add credits to a user (admin/top-up)
router.post("/credits/add", async (req, res) => {
  if (!isSupabaseConfigured()) {
    return res.json({ enabled: false, message: "Supabase not configured" });
  }
  const { userId, amount, type = "credit", description } = req.body;
  if (!userId || typeof amount !== "number") {
    return res.status(400).json({ error: "userId and amount are required" });
  }
  try {
    const { addCredits } = await import("@workspace/supabase");
    const result = await addCredits(userId, amount, type, description);
    res.json({ enabled: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
