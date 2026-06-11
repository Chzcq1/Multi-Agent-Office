import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export { runMigrations } from "./migrate";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const useSSL =
  process.env.NODE_ENV === "production" ||
  (process.env.DATABASE_URL?.includes("supabase") ?? false) ||
  (process.env.DATABASE_URL?.includes("neon.tech") ?? false);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.NODE_ENV === "production" ? 3 : 10,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
