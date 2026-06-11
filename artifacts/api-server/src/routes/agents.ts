import { Router } from "express";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const dbError = (err: unknown, res: any) => {
  const msg = (err as Error).message ?? String(err);
  console.error("[agents] DB error:", msg);
  return res.status(503).json({
    error: "Database error",
    detail: msg,
    hint: "Visit /api/health to check DB connection",
  });
};

router.get("/agents", async (_req, res) => {
  try {
    const agents = await db.select().from(agentsTable).orderBy(agentsTable.id);
    res.json(agents);
  } catch (err) { return dbError(err, res); }
});

router.post("/agents", async (req, res) => {
  try {
    const { name, role, avatar, department, customPrompt } = req.body;
    if (!name?.trim() || !role?.trim() || !avatar?.trim() || !department?.trim()) {
      return res.status(400).json({ error: "name, role, avatar, and department are required" });
    }
    const existing = await db.select().from(agentsTable);
    if (existing.length >= 4) {
      return res.status(400).json({ error: "Maximum of 4 agents allowed" });
    }
    const [agent] = await db.insert(agentsTable).values({
      name: name.trim(),
      role: role.trim(),
      avatar: avatar.trim(),
      department: department.trim(),
      customPrompt: customPrompt?.trim() || null,
      status: "idle",
    }).returning();
    res.status(201).json(agent);
  } catch (err) { return dbError(err, res); }
});

router.get("/agents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, id));
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  } catch (err) { return dbError(err, res); }
});

router.put("/agents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(agentsTable).where(eq(agentsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Agent not found" });
    const { name, role, avatar, department, customPrompt } = req.body;
    if (!name?.trim() || !role?.trim() || !avatar?.trim() || !department?.trim()) {
      return res.status(400).json({ error: "name, role, avatar, and department are required" });
    }
    const [updated] = await db.update(agentsTable).set({
      name: name.trim(),
      role: role.trim(),
      avatar: avatar.trim(),
      department: department.trim(),
      customPrompt: customPrompt?.trim() || null,
    }).where(eq(agentsTable.id, id)).returning();
    res.json(updated);
  } catch (err) { return dbError(err, res); }
});

router.delete("/agents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(agentsTable).where(eq(agentsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Agent not found" });
    await db.delete(agentsTable).where(eq(agentsTable.id, id));
    res.status(204).end();
  } catch (err) { return dbError(err, res); }
});

export default router;
