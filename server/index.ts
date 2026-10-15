import { loadConfig, publicConfig } from "./config.js";
import { createApp } from "./routes/app.js";
import { PostgresRepository } from "./repositories/postgres.js";
import type { PoolClient } from "pg";
async function main() {
  const config = loadConfig();
  const { app, repo } = createApp({ config });
  let lockClient: PoolClient | undefined;
  if (repo instanceof PostgresRepository) {
    await repo.verifyReady();
    lockClient = await repo.pool.connect();
    const result = await lockClient.query(
      "select pg_try_advisory_lock(181903,2) as acquired",
    );
    if (!result.rows[0].acquired)
      throw new Error("API_INSTANCE_ALREADY_RUNNING");
  }
  await repo.cleanup();
  await app.listen({ port: config.PORT, host: config.HOST });
  console.info(
    `Banglog Plus API http://${config.HOST}:${config.PORT} | AI=${config.AI_MODE} DB=${config.REPOSITORY} ready=${publicConfig(config).ready}`,
  );
  const timer = setInterval(() => {
    void repo.cleanup().catch(() => console.error("CLEANUP_FAILED"));
  }, 60000);
  timer.unref();
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, async () => {
      clearInterval(timer);
      lockClient?.release();
      await app.close();
      process.exit(0);
    });
}
void main().catch(() => {
  console.error(
    "STARTUP_FAILED: check environment names, database migration/role/TLS, port and single-instance lock. Secret values are not logged.",
  );
  process.exit(1);
});
