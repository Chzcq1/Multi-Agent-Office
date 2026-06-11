import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";

export const finalSummariesTable = pgTable("final_summaries", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  summaryText: text("summary_text").notNull(),
  userFeedback: text("user_feedback"),
  feedbackNote: text("feedback_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFinalSummarySchema = createInsertSchema(finalSummariesTable).omit({ id: true, createdAt: true });
export type InsertFinalSummary = z.infer<typeof insertFinalSummarySchema>;
export type FinalSummary = typeof finalSummariesTable.$inferSelect;
