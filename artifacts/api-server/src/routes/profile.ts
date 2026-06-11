import { Router } from "express";
import { db, userProfilesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/profile", async (_req, res) => {
  const [profile] = await db.select().from(userProfilesTable).orderBy(desc(userProfilesTable.createdAt)).limit(1);
  if (!profile) return res.status(404).json({ error: "No profile found" });
  res.json(profile);
});

router.post("/profile", async (req, res) => {
  const { displayName, role, avatarEmoji } = req.body;
  if (!displayName?.trim() || !role?.trim()) {
    return res.status(400).json({ error: "displayName and role are required" });
  }
  const [existing] = await db.select().from(userProfilesTable).limit(1);
  if (existing) {
    const [updated] = await db
      .update(userProfilesTable)
      .set({ displayName: displayName.trim(), role: role.trim(), avatarEmoji: avatarEmoji ?? "👨‍💼", updatedAt: new Date() })
      .where(eq(userProfilesTable.id, existing.id))
      .returning();
    return res.json(updated);
  }
  const [created] = await db
    .insert(userProfilesTable)
    .values({ displayName: displayName.trim(), role: role.trim(), avatarEmoji: avatarEmoji ?? "👨‍💼" })
    .returning();
  res.status(201).json(created);
});

export default router;
