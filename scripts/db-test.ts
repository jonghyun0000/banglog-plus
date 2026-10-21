import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
import { PostgresRepository } from "../server/repositories/postgres.js";
import { defaultIntake, consentVersion } from "../shared/schema.js";
import { makeAnalysis } from "../server/domain/analysis.js";
import { sources } from "../server/sources/catalog.js";
import { createApp } from "../server/routes/app.js";
import { loadConfig } from "../server/config.js";
import { validatePlan } from "../server/ai/provider.js";
const exec = promisify(execFile);
const dir = await mkdtemp(join(tmpdir(), "banglog-pg-"));
const server = createServer();
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const address = server.address();
if (!address || typeof address === "string") throw new Error("NO_PORT");
const port = address.port;
await new Promise<void>((r) => server.close(() => r()));
let running = false;
let admin: pg.Pool | undefined;
let repo: PostgresRepository | undefined;
const passed: string[] = [];
function pass(name: string) {
  passed.push(name);
  console.info(`PASS ${name}`);
}
try {
  await exec("initdb", [
    "-D",
    join(dir, "data"),
    "-U",
    "banglog_test",
    "--auth=trust",
    "--no-locale",
    "--encoding=UTF8",
  ]);
  await exec("pg_ctl", [
    "-D",
    join(dir, "data"),
    "-l",
    join(dir, "pg.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -k ${dir}`,
    "-w",
    "start",
  ]);
  running = true;
  const url = `postgresql://banglog_test@127.0.0.1:${port}/postgres`;
  admin = new pg.Pool({ connectionString: url });
  for (const name of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await admin.query(await readFile(`supabase/migrations/${name}`, "utf8"));
  pass("migrations apply on isolated PostgreSQL");
  repo = new PostgresRepository(url, false);
  const a = await repo.createGuest("a".repeat(64), "test"),
    b = await repo.createGuest("b".repeat(64), "test");
  assert.equal((await repo.authenticate("a".repeat(64)))?.id, a.id);
  assert.equal(await repo.authenticate("c".repeat(64)), null);
  pass("hashed session authentication");
  const key = randomUUID(),
    digest = createHash("sha256")
      .update(JSON.stringify(defaultIntake))
      .digest("hex");
  const created = await repo.createAnalysis(a.id, key, digest, defaultIntake);
  const id = created.record.id;
  assert.equal(
    (await repo.createAnalysis(a.id, key, digest, defaultIntake)).created,
    false,
  );
  await assert.rejects(() =>
    repo!.createAnalysis(a.id, key, "other", defaultIntake),
  );
  pass("unique idempotency and input version");
  const result = makeAnalysis(defaultIntake, id, "mock", "demo");
  assert.equal(await repo.finish(a.id, id, result), true);
  assert.equal((await repo.getAnalysis(a.id, id))?.result?.analysisId, id);
  assert.equal(await repo.getAnalysis(b.id, id), null);
  pass("owned result read/write");
  await repo.feedback(a.id, id, {
    helpful: "yes",
    understood: "yes",
    errorType: "none",
  });
  await assert.rejects(() =>
    repo!.feedback(b.id, id, {
      helpful: "no",
      understood: "no",
      errorType: "fact",
    }),
  );
  pass("cross-owner feedback rejected");
  await repo.transaction(b.id, async (c) => {
    const q = await c.query(
      "select * from banglog_plus.analysis_sessions where id=$1",
      [id],
    );
    assert.equal(q.rowCount, 0);
    const u = await c.query(
      "update banglog_plus.analysis_sessions set state='cancelled' where id=$1",
      [id],
    );
    assert.equal(u.rowCount, 0);
  });
  await assert.rejects(() =>
    repo!.transaction(b.id, async (c) => {
      await c.query(
        "insert into banglog_plus.feedback_events values($1,$2,'yes','yes','none')",
        [id, b.id],
      );
    }),
  );
  pass("RLS and composite foreign keys prevent ownership forgery");
  await admin.query(
    "create role anon nologin; create role authenticated nologin;",
  );
  for (const role of ["anon", "authenticated"]) {
    const c = await admin.connect();
    try {
      await c.query("begin");
      await c.query(`set local role ${role}`);
      await assert.rejects(() =>
        c.query("select * from banglog_plus.analysis_sessions"),
      );
      await c.query("rollback");
    } finally {
      c.release();
    }
  }
  const grants = await admin.query(
    "select has_schema_privilege('anon','banglog_plus','USAGE') as anon,has_schema_privilege('authenticated','banglog_plus','USAGE') as authenticated",
  );
  assert.equal(grants.rows[0].anon, false);
  assert.equal(grants.rows[0].authenticated, false);
  pass("public/anon/authenticated schema access denied");
  const rls = await admin.query(
    "select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='banglog_plus' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity",
  );
  assert.equal(rls.rows[0].n, 11);
  pass("RLS enabled and forced on all 11 tables");
  await assert.rejects(() =>
    admin!.query(
      "update banglog_plus.legal_source_versions set location='changed'",
    ),
  );
  await assert.rejects(() =>
    repo!.transaction(a.id, async (c) => {
      await c.query(
        "insert into banglog_plus.result_sources values($1,$2,'fake','fake','bad','bad')",
        [id, a.id],
      );
    }),
  );
  pass("immutable source versions and citation foreign keys");
  const reservations = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      repo!.reserve(10, 1, { calls: 3, tokens: 30, usd: 3 }),
    ),
  );
  assert.equal(reservations.filter((x) => x.status === "fulfilled").length, 3);
  pass("atomic concurrent budget reservations");
  const pending = await repo.createAnalysis(b.id, randomUUID(), "next", {
    ...defaultIntake,
    inputVersion: 2,
  });
  await repo.deleteGuest(b.id);
  assert.equal(
    await repo.finish(
      b.id,
      pending.record.id,
      makeAnalysis(
        { ...defaultIntake, inputVersion: 2 },
        pending.record.id,
        "mock",
        "demo",
      ),
    ),
    false,
  );
  pass("late result cannot recreate deleted data");
  await admin.query(
    "update banglog_plus.guest_sessions set expires_at=now()-interval '1 minute' where id=$1",
    [a.id],
  );
  assert.equal(await repo.authenticate("a".repeat(64)), null);
  assert.equal(await repo.cleanup(), 1);
  const rows = await admin.query(
    "select (select count(*) from banglog_plus.analysis_sessions)+(select count(*) from banglog_plus.feedback_events)+(select count(*) from banglog_plus.question_answers)+(select count(*) from banglog_plus.case_facts) as n",
  );
  assert.equal(Number(rows.rows[0].n), 0);
  pass("expiry authentication and cascade cleanup");
  const catalog = await admin.query(
    "select distinct on (source_id) metadata from banglog_plus.legal_source_versions order by source_id, checked_at desc",
  );
  assert.deepEqual(
    catalog.rows
      .map((r) => r.metadata)
      .sort((a, b) => a.id.localeCompare(b.id)),
    [...sources].sort((a, b) => a.id.localeCompare(b.id)),
  );
  pass("migration source catalog matches runtime catalog");
  await repo.verifyReady();
  const cGuest = await repo.createGuest("c".repeat(64), "test");
  const cAnalysis = await repo.createAnalysis(
    cGuest.id,
    randomUUID(),
    "citation-test",
    defaultIntake,
  );
  const cited = validatePlan(
    {
      direction: "undetermined",
      claimIds: ["maintenance"],
      sourceVersions: [
        { sourceId: sources[0].id, version: sources[0].version },
      ],
    },
    defaultIntake,
    cAnalysis.record.id,
    "test-model",
  );
  assert.equal(await repo.finish(cGuest.id, cAnalysis.record.id, cited), true);
  const citations = await admin.query(
    "select count(*)::int as n from banglog_plus.result_sources",
  );
  assert.equal(citations.rows[0].n, 1);
  await repo.deleteGuest(cGuest.id);
  pass("validated source versions persist with result");
  for (const [index, issue] of (
    ["surface", "drain", "fixture"] as const
  ).entries()) {
    const guest = await repo.createGuest(String(index + 4).repeat(64), "test");
    const input = { ...defaultIntake, issue };
    const added = await repo.createAnalysis(
      guest.id,
      randomUUID(),
      "new-category",
      input,
    );
    await repo.finish(
      guest.id,
      added.record.id,
      makeAnalysis(input, added.record.id, "mock", "demo"),
    );
    assert.equal(
      (await repo.getAnalysis(guest.id, added.record.id))?.input.issue,
      issue,
    );
    await repo.deleteGuest(guest.id);
  }
  pass(
    "expanded repair categories persist and delete under existing ownership rules",
  );
  const apiRepo = new PostgresRepository(url, false);
  const { app } = createApp({
    config: loadConfig({
      REPOSITORY: "database",
      DATABASE_URL: url,
      DATABASE_SSL: "disable",
    }),
    repository: apiRepo,
  });
  try {
    const session = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { noticeAccepted: true, consentVersion },
    });
    assert.equal(session.statusCode, 201);
    const headers = { authorization: `Bearer ${session.json().token}` };
    const response = await app.inject({
      method: "POST",
      url: "/api/analyses",
      headers,
      payload: { intake: defaultIntake, idempotencyKey: randomUUID() },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().mode, "mock");
    assert.equal(
      (await app.inject({ method: "DELETE", url: "/api/session", headers }))
        .statusCode,
      204,
    );
  } finally {
    await app.close();
  }
  pass("Fastify API through PostgreSQL: create, analyze, delete");
  // Dedicated deployment login must be a member of this private role, not superuser.
  await writeFile(
    "docs/db-test-results.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        engine: (await exec("pg_ctl", ["--version"])).stdout.trim(),
        remoteApplied: false,
        passed,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await repo?.close();
  await admin?.end();
  if (running)
    await exec("pg_ctl", ["-D", join(dir, "data"), "-m", "fast", "-w", "stop"]);
  await rm(dir, { recursive: true, force: true });
}
