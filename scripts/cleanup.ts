import { loadConfig } from "../server/config.js";
import { PostgresRepository } from "../server/repositories/postgres.js";
const config = loadConfig();
if (!config.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required; memory cleanup runs inside the API",
  );
const repo = new PostgresRepository(
  config.DATABASE_URL,
  config.DATABASE_SSL !== "disable",
);
try {
  console.info(
    JSON.stringify({ deletedExpiredSessions: await repo.cleanup() }),
  );
} finally {
  await repo.close();
}
