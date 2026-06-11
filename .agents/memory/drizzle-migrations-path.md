---
  name: Drizzle migrations path
  description: How migration files are located correctly in dev vs bundled dist
  ---

  ## Problem
  When esbuild bundles the API server into dist/index.mjs, import.meta.url points to dist/.
  The drizzle migrator needs a path to the migrations folder.
  In dev (ts source), migrations are at lib/db/migrations/ (relative to migrate.ts source).
  In bundled dist/, migrations need to be AT dist/migrations/.

  ## Solution
  1. build.mjs copies lib/db/migrations/ to dist/migrations/ during every build
  2. migrate.ts detects if running from dist/ by checking if import.meta.url includes "/dist/"
     - If yes: path.resolve(currentDir, "./migrations")  
     - If no: path.resolve(currentDir, "../../migrations") (up from lib/db/src/ to lib/db/migrations/)

  ## Also: existing tables
  Replit uses drizzle-kit push (no migration journal), so runMigrations() will warn "already exists" — caught and logged as one-line warning, server continues normally.
  