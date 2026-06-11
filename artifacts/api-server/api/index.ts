import app from "../src/app";
import { runMigrations } from "@workspace/db";

let migrated = false;

async function ensureMigrated() {
  if (migrated) return;
  try {
    await runMigrations();
    migrated = true;
  } catch (err) {
    console.warn("[db] Migration warning:", err);
    migrated = true;
  }
}

export default async function handler(req: any, res: any) {
  await ensureMigrated();
  return app(req, res);
}
