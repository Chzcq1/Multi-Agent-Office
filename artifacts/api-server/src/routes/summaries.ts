import { Router } from "express";
import { db, finalSummariesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/tasks/:id/summary", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [summary] = await db
      .select()
      .from(finalSummariesTable)
      .where(eq(finalSummariesTable.taskId, id));
    if (!summary) return res.status(404).json({ error: "Summary not found" });
    res.json(summary);
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error("[summaries] DB error:", msg);
    res.status(503).json({
      error: "Database error",
      detail: msg,
      hint: "Visit /api/health to check DB connection",
    });
  }
});

export default router;
