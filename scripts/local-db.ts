import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  access,
  chmod,
  unlink,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import pg from "pg";
const exec = promisify(execFile),
  dir = resolve(".local"),
  data = join(dir, "postgres");
async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
async function main() {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  if (process.argv.includes("--stop")) {
    await exec("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    console.info("Local database stopped. Data preserved in .local/.");
    return;
  }
  const envFile = join(dir, "database.env");
  if (await exists(join(data, "PG_VERSION"))) {
    if (!(await exists(envFile))) throw new Error("EXISTING_DB_CONFIG_MISSING");
    try {
      await exec("pg_ctl", ["-D", data, "status"]);
    } catch {
      await exec("pg_ctl", [
        "-D",
        data,
        "-l",
        join(dir, "postgres.log"),
        "-o",
        "-h 127.0.0.1 -p 54329 -k '' -c log_min_messages=fatal -c log_min_error_statement=panic",
        "-w",
        "start",
      ]);
    }
    console.info("Existing local database is ready. Run npm run dev:db.");
    return;
  }
  const ownerPassword = randomBytes(32).toString("hex"),
    appPassword = randomBytes(32).toString("hex");
  const pwFile = join(dir, "init-password");
  await writeFile(pwFile, ownerPassword, { mode: 0o600 });
  try {
    await exec("initdb", [
      "-D",
      data,
      "-U",
      "banglog_plus_owner",
      "--auth=scram-sha-256",
      `--pwfile=${pwFile}`,
      "--no-locale",
      "--encoding=UTF8",
    ]);
  } finally {
    await unlink(pwFile);
  }
  await exec("pg_ctl", [
    "-D",
    data,
    "-l",
    join(dir, "postgres.log"),
    "-o",
    "-h 127.0.0.1 -p 54329 -k '' -c log_min_messages=fatal -c log_min_error_statement=panic",
    "-w",
    "start",
  ]);
  const ownerUrl = `postgresql://banglog_plus_owner:${ownerPassword}@127.0.0.1:54329/postgres`;
  await writeFile(
    join(dir, "owner.env"),
    `DATABASE_URL=${ownerUrl}\nDATABASE_SSL=disable\n`,
    { mode: 0o600 },
  );
  const pool = new pg.Pool({ connectionString: ownerUrl });
  try {
    for (const name of (await readdir("supabase/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await pool.query(
        await readFile(join("supabase/migrations", name), "utf8"),
      );
    // Password is generated hex, never user input, never logged.
    await pool.query(
      `create role banglog_plus_local login password '${appPassword}' nosuperuser nobypassrls; grant banglog_plus_server to banglog_plus_local;`,
    );
    await writeFile(
      envFile,
      `REPOSITORY=database\nDATABASE_URL=postgresql://banglog_plus_local:${appPassword}@127.0.0.1:54329/postgres\nDATABASE_SSL=disable\n`,
      { mode: 0o600 },
    );
  } finally {
    await pool.end();
  }
  console.info(
    "Local PostgreSQL ready on 127.0.0.1:54329. Private role configured. Run npm run dev:db. Credentials saved privately under .local/, not printed.",
  );
}
void main().catch(() => {
  console.error(
    "LOCAL_DB_FAILED: check PostgreSQL tools, port 54329 and .local/ state. Existing files were preserved; credential values are not logged.",
  );
  process.exitCode = 1;
});
