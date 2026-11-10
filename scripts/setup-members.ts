import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import pg from "pg";
const env = parse(await readFile(".local/owner.env"));
if (
  !env.DATABASE_URL ||
  !["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(env.DATABASE_URL).hostname,
  )
)
  throw new Error("LOCAL_ONLY");
const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
try {
  const { rows } = await pool.query(
    "select to_regclass('banglog_plus.member_history') as history",
  );
  if (!rows[0].history)
    await pool.query(
      await readFile(
        "supabase/migrations/20261103062040_member_history_and_usage_summary.sql",
        "utf8",
      ),
    );
  const r = await pool.query(
    "select count(*)::int as tables from pg_tables where schemaname='banglog_plus' and tablename in ('member_history','usage_daily_summary','answer_daily_summary')",
  );
  if (r.rows[0].tables !== 3) throw new Error("SCHEMA_MISMATCH");
  console.info(
    "Local member history and aggregate schema ready (3 tables); remote unchanged.",
  );
} finally {
  await pool.end();
}
