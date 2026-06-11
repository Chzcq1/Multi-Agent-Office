import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";

export const discussionLogsTable = pgTable("discussion_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  senderAgent: text("sender_agent").notNull(),
  agentRole: text("agent_role").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDiscussionLogSchema = createInsertSchema(discussionLogsTable).omit({ id: true, createdAt: true });
export type InsertDiscussionLog = z.infer<typeof insertDiscussionLogSchema>;
export type DiscussionLog = typeof discussionLogsTable.$inferSelect;
