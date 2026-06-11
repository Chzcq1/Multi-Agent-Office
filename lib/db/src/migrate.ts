import pg from "pg";

const { Pool } = pg;

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS "conversations" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "messages" (
    "id" serial PRIMARY KEY NOT NULL,
    "conversation_id" integer NOT NULL,
    "role" text NOT NULL,
    "content" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "agents" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "role" text NOT NULL,
    "status" text DEFAULT 'idle' NOT NULL,
    "avatar" text NOT NULL,
    "department" text NOT NULL,
    "custom_prompt" text,
    "created_at" timestamp DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "tasks" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_command" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "discussion_logs" (
    "id" serial PRIMARY KEY NOT NULL,
    "task_id" integer NOT NULL,
    "sender_agent" text NOT NULL,
    "agent_role" text NOT NULL,
    "message" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "final_summaries" (
    "id" serial PRIMARY KEY NOT NULL,
    "task_id" integer NOT NULL,
    "summary_text" text NOT NULL,
    "user_feedback" text,
    "feedback_note" text,
    "created_at" timestamp DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "user_profiles" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" text NOT NULL,
    "role" text NOT NULL,
    "avatar_emoji" text DEFAULT '👨‍💼' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  );

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'messages_conversation_id_conversations_id_fk'
    ) THEN
      ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk"
        FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade;
    END IF;
  END $$;

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'discussion_logs_task_id_tasks_id_fk'
    ) THEN
      ALTER TABLE "discussion_logs" ADD CONSTRAINT "discussion_logs_task_id_tasks_id_fk"
        FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade;
    END IF;
  END $$;

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'final_summaries_task_id_tasks_id_fk'
    ) THEN
      ALTER TABLE "final_summaries" ADD CONSTRAINT "final_summaries_task_id_tasks_id_fk"
        FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade;
    END IF;
  END $$;
`;

export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set before running migrations");
  }

  const useSSL =
    process.env.NODE_ENV === "production" ||
    process.env.DATABASE_URL.includes("supabase") ||
    process.env.DATABASE_URL.includes("neon.tech");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
  });

  try {
    await pool.query(INIT_SQL);
    console.log("[db] Schema initialized (CREATE IF NOT EXISTS)");
  } finally {
    await pool.end();
  }
}
