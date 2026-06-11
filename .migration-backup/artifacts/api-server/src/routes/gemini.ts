import { Router } from "express";
import { db, conversations as conversationsTable, messages as messagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();

function getAI() {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not set");
  return new GoogleGenAI({
    apiKey,
    ...(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ? {
      httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL }
    } : {}),
  });
}

router.get("/gemini/conversations", async (_req, res) => {
  const convs = await db.select().from(conversationsTable).orderBy(desc(conversationsTable.createdAt));
  res.json(convs);
});

router.post("/gemini/conversations", async (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "title is required" });
  const [conv] = await db.insert(conversationsTable).values({ title }).returning();
  res.status(201).json(conv);
});

router.get("/gemini/conversations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) return res.status(404).json({ error: "Not found" });
  const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(messagesTable.createdAt);
  res.json({ ...conv, messages });
});

router.delete("/gemini/conversations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) return res.status(404).json({ error: "Not found" });
  await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
  res.status(204).end();
});

router.get("/gemini/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(messagesTable.createdAt);
  res.json(msgs);
});

router.post("/gemini/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "content is required" });

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) return res.status(404).json({ error: "Not found" });

  await db.insert(messagesTable).values({ conversationId: id, role: "user", content });
  const history = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(messagesTable.createdAt);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const ai = getAI();
  let fullResponse = "";

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: history.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

router.post("/gemini/generate-image", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: "prompt is required" });
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseModalities: ["IMAGE", "TEXT"] },
    });
    const part = response.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData);
    if (!part?.inlineData) return res.status(500).json({ error: "No image generated" });
    res.json({ b64_json: part.inlineData.data, mimeType: part.inlineData.mimeType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

export default router;
