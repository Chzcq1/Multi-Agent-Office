import { Router } from "express";
import { pool } from "@workspace/db";
import { runMigrations } from "@workspace/db";

const router = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/health", async (_req, res) => {
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    status: "checking",
    env: {},
    database: {},
    tables: [],
    migrations: null,
  };

  const envStatus: Record<string, string> = {};
  let missingRequired = false;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    envStatus["DATABASE_URL"] = "❌ MISSING";
    missingRequired = true;
  } else {
    try {
      const u = new URL(dbUrl);
      envStatus["DATABASE_URL"] = `✅ set (host=${u.hostname}, port=${u.port || "5432"}, db=${u.pathname.slice(1)})`;
    } catch {
      envStatus["DATABASE_URL"] = "⚠️ set but not a valid URL";
    }
  }

  const githubToken = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!githubToken) {
    envStatus["GITHUB_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN"] = "❌ MISSING — AI agents will fail";
    missingRequired = true;
  } else {
    const which = process.env.GITHUB_TOKEN ? "GITHUB_TOKEN" : "GITHUB_PERSONAL_ACCESS_TOKEN";
    envStatus["GITHUB_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN"] = `✅ set via ${which} (length=${githubToken.length})`;
  }

  const nodeEnv = process.env.NODE_ENV;
  envStatus["NODE_ENV"] = nodeEnv ? `✅ ${nodeEnv}` : "— not set (defaults to development)";

  const port = process.env.PORT;
  envStatus["PORT"] = port ? `✅ ${port}` : "— not set (OK on Vercel serverless)";

  const corsOrigin = process.env.CORS_ORIGIN;
  envStatus["CORS_ORIGIN"] = corsOrigin ? `✅ ${corsOrigin}` : "— not set (allows all origins)";

  const sessionSecret = process.env.SESSION_SECRET;
  envStatus["SESSION_SECRET"] = sessionSecret ? `✅ set (length=${sessionSecret.length})` : "— not set (optional)";

  result.env = envStatus;

  if (!process.env.DATABASE_URL) {
    result.status = "error";
    result.database = { error: "DATABASE_URL is not set — cannot connect" };
    return res.status(503).json(result);
  }

  if (missingRequired) {
    result.status = "degraded";
  }

  let client: any;
  try {
    client = await (pool as any).connect();

    const pingResult = await client.query("SELECT version(), now() AS server_time");
    result.database = {
      connected: true,
      version: pingResult.rows[0].version,
      server_time: pingResult.rows[0].server_time,
    };

    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    result.tables = tablesResult.rows.map((r: any) => r.table_name);

    const expectedTables = [
      "agents",
      "conversations",
      "discussion_logs",
      "final_summaries",
      "messages",
      "tasks",
      "user_profiles",
    ];
    const missingTables = expectedTables.filter(
      (t) => !(result.tables as string[]).includes(t),
    );

    if (missingTables.length > 0) {
      result.migrations = {
        status: "⚠️ tables missing — running migration now",
        missing: missingTables,
      };
      try {
        client.release();
        client = null;
        await runMigrations();
        const c2 = await (pool as any).connect();
        const afterResult = await c2.query(`
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);
        result.tables = afterResult.rows.map((r: any) => r.table_name);
        c2.release();
        result.migrations = {
          status: "✅ migration ran successfully",
          tables_created: missingTables,
        };
      } catch (migErr) {
        result.migrations = {
          status: "❌ migration failed",
          error: (migErr as Error).message,
        };
      }
    } else {
      result.migrations = { status: "✅ all tables present", missing: [] };
    }

    result.status = missingRequired ? "degraded" : "ok";
    res.json(result);
  } catch (err) {
    const error = err as Error;
    result.status = "error";
    result.database = {
      connected: false,
      error: error.message,
      hint: "Check DATABASE_URL (Supabase Transaction Pooler port 6543 + ?sslmode=require)",
    };
    res.status(503).json(result);
  } finally {
    if (client) {
      try { client.release(); } catch {}
    }
  }
});

export default router;
