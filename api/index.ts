import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "../artifacts/api-server/src/routes/index";
import { runMigrations } from "../lib/db/src/migrate";

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : true;

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const msg = err?.message ?? String(err);
  console.error("[express] Unhandled error:", msg);
  res.status(500).json({
    error: "Internal server error",
    detail: msg,
    hint: "Visit /api/health to check DB connection and env vars",
  });
});

let migrationPromise: Promise<void> | null = null;

async function ensureMigrated(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    if (!process.env.DATABASE_URL) {
      console.error("[db] DATABASE_URL not set — skipping migration");
      return;
    }
    try {
      await runMigrations();
      console.log("[db] Migration complete");
    } catch (err) {
      console.error(
        "[db] Migration error (tables may already exist):",
        (err as Error).message?.split("\n")[0],
      );
      migrationPromise = null;
    }
  })();
  return migrationPromise;
}

ensureMigrated();

export default async function handler(req: Request, res: Response) {
  await ensureMigrated();
  return app(req, res);
}
