import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "@workspace/db";

async function start() {
  try {
    await runMigrations();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Migration skipped (tables may already exist): ${msg.split("\n")[0]}`);
  }

  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
