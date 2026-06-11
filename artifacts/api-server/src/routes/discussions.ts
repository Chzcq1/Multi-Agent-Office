import { Router } from "express";
import { db, discussionLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/tasks/:id/discussions", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const logs = await db
      .select()
      .from(discussionLogsTable)
      .where(eq(discussionLogsTable.taskId, id))
      .orderBy(discussionLogsTable.createdAt);
    res.json(logs);
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error("[discussions] DB error:", msg);
    res.status(503).json({
      error: "Database error",
      detail: msg,
      hint: "Visit /api/health to check DB connection",
    });
  }
});

export default router;
