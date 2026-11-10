import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import pg from "pg";
import { PostgresRepository } from "../server/repositories/postgres.js";
import { PostgresKnowledgeRetriever } from "../server/sources/retrieval.js";
import {
  datasetVersion,
  datasetChunks,
  datasetSources,
} from "../server/sources/dataset.js";
import { defaultIntake } from "../shared/schema.js";

// Intentionally local-only. Remote application needs an explicit deployment decision.
async function main() {
  const owner = parse(await readFile(".local/owner.env"));
  const runtime = parse(await readFile(".local/database.env"));
  for (const url of [owner.DATABASE_URL, runtime.DATABASE_URL])
    if (
      !url ||
      !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
    )
      throw new Error("LOCAL_DATABASE_REQUIRED");
  const admin = new pg.Pool({
    connectionString: owner.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  const repo = new PostgresRepository(runtime.DATABASE_URL, false);
  try {
    const constraint = await admin.query(
      "select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='banglog_plus.analysis_sessions'::regclass and conname='analysis_sessions_issue_check'",
    );
    if (!constraint.rows[0]?.definition.includes("fixture"))
      await admin.query(
        await readFile(
          "supabase/migrations/20261021022508_expand_repair_issues.sql",
          "utf8",
        ),
      );
    const exists = await admin.query(
      "select to_regclass('banglog_plus.knowledge_chunks') as name",
    );
    if (!exists.rows[0].name)
      await admin.query(
        await readFile(
          "supabase/migrations/20261103045320_repair_knowledge_dataset.sql",
          "utf8",
        ),
      );
    await admin.query(await readFile("data/repair-knowledge.v2.sql", "utf8"));
    const counts = await admin.query(
      "select count(*)::int as chunks, count(distinct source_id)::int as sources from banglog_plus.knowledge_chunks where dataset_version=$1",
      [datasetVersion],
    );
    if (
      counts.rows[0].chunks !== datasetChunks.length ||
      counts.rows[0].sources !== datasetSources.length
    )
      throw new Error("DATASET_VERSION_MISMATCH");
    const retrieval = await new PostgresKnowledgeRetriever(repo).retrieve(
      { ...defaultIntake, issue: "surface", observation: "floor-dent" },
      new AbortController().signal,
    );
    console.info(
      JSON.stringify({
        localOnly: true,
        datasetVersion,
        ...counts.rows[0],
        exampleRetrieved: retrieval.passages.map((p) => p.id),
        externalAiCalled: false,
        remoteApplied: false,
      }),
    );
  } finally {
    await repo.close();
    await admin.end();
  }
}
void main().catch(() => {
  console.error(
    "KNOWLEDGE_SETUP_FAILED: run npm run db:local first and check local schema/version. Credentials were not printed.",
  );
  process.exitCode = 1;
});
