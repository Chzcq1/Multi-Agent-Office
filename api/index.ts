import express from "express";
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

let migrated = false;

export default async function handler(req: any, res: any) {
  if (!migrated) {
    try {
      await runMigrations();
    } catch (err) {
      console.warn(
        "[db] Migration skipped:",
        (err as Error).message?.split("\n")[0],
      );
    }
    migrated = true;
  }
  return app(req, res);
}
