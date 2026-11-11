import { releaseVersion } from "../shared/release.js";
import { evaluateResearchRetrieval } from "./research-evaluation.js";
import { Operations } from "../server/operations.js";
import { scryptSync } from "node:crypto";
import { PostgresHistory } from "../server/repositories/history.js";
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
import { PostgresKnowledgeRetriever } from "../server/sources/retrieval.js";
import { OpenAIAnalysisProvider } from "../server/ai/provider.js";
import OpenAI from "openai";
import { datasetVersion } from "../server/sources/dataset.js";
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
  await admin.query(await readFile("data/repair-knowledge.v2.sql", "utf8"));
  await admin.query(await readFile("data/repair-knowledge.v2.sql", "utf8"));
  const verified = await admin.query(
    `select count(*)::int as count from banglog_plus.legal_source_versions where metadata->'verification'->>'status'='cross_checked' and human_legal_review='pending' and use_scope='internal'`,
  );
  assert.equal(verified.rows[0].count, 5);
  const chunksV2 = await admin.query(
    "select count(*)::int as count from banglog_plus.knowledge_chunks where dataset_version=$1",
    [datasetVersion],
  );
  assert.equal(chunksV2.rows[0].count, 7);
  pass(
    "cross-checked cases: five provenance records, seven active chunks and idempotent import",
  );
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
  const history = new PostgresHistory(repo);
  const userA = randomUUID(),
    userB = randomUUID();
  const ownedRecord = (await repo.getAnalysis(a.id, id))!;
  await history.save(userA, ownedRecord, "사용자가 수정한 연락 문구");
  await history.save(userA, ownedRecord, "중복 요청으로 덮어쓰지 않음");
  const saved = await history.list(userA);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].result.savedMessage, "사용자가 수정한 연락 문구");
  assert.equal(saved[0].result.messageDraft, result.messageDraft);
  assert.equal(
    (await repo.getAnalysis(a.id, id))?.result?.messageDraft,
    result.messageDraft,
  );
  assert.equal((await history.list(userB)).length, 0);
  await history.remove(userB, saved[0].id);
  assert.equal((await history.list(userA)).length, 1);
  const rawIsolation = await repo.transaction("", async (c) => {
    await c.query("select set_config('banglog.user_id',$1,true)", [userB]);
    return c.query("select id from banglog_plus.member_history");
  });
  assert.equal(rawIsolation.rowCount, 0);
  pass(
    "member history: idempotent saves, own-only list/delete and database RLS",
  );
  const countBefore = await admin.query(
    "select sum(completed)::int as n from banglog_plus.usage_daily_summary",
  );
  assert.equal(await repo.finish(a.id, id, result), false);
  const countAfter = await admin.query(
    "select sum(completed)::int as n from banglog_plus.usage_daily_summary",
  );
  assert.equal(countBefore.rows[0].n, countAfter.rows[0].n);
  assert.equal(countAfter.rows[0].n, 1);
  pass("aggregate completion count is atomic and not duplicated by retries");
  const answerCounts = await admin.query(
    "select question,answer,completed from banglog_plus.answer_daily_summary",
  );
  assert.equal(answerCounts.rows.length, 9);
  assert.equal(
    answerCounts.rows.some((r) =>
      ["description", "contract", "inputVersion"].includes(r.question),
    ),
    false,
  );
  assert.equal(
    answerCounts.rows.every((r) => Number(r.completed) === 1),
    true,
  );
  pass(
    "answer aggregates retain structured choices only and exclude free text and identifiers",
  );

  await admin.query(
    "update banglog_plus.member_history set expires_at=now()-interval '1 day' where id=$1",
    [saved[0].id],
  );
  assert.equal((await history.list(userA)).length, 0);
  await repo.cleanup();
  assert.equal(
    (
      await admin.query(
        "select count(*)::int as n from banglog_plus.member_history",
      )
    ).rows[0].n,
    0,
  );
  pass("member history expiry hides records and cleanup removes them");

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
  assert.equal(rls.rows[0].n, 24);
  pass("RLS enabled and forced on all 24 tables");
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
    "select distinct on (source_id) metadata from banglog_plus.legal_source_versions where source_id=any($1::text[]) order by source_id, checked_at desc",
    [sources.map((s) => s.id)],
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
      explanation:
        "현재 입력만으로 원인이나 비용 부담을 확정할 수 없어요. 입주 당시 상태와 점검 기록을 함께 확인해 주세요.",
      claimIds: ["maintenance"],
      sourceVersions: [
        { sourceId: sources[0].id, version: sources[0].version },
      ],
    },
    defaultIntake,
    cAnalysis.record.id,
    "test-model",
    await new PostgresKnowledgeRetriever(repo).retrieve(
      defaultIntake,
      new AbortController().signal,
    ),
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
    const input = {
      ...defaultIntake,
      issue,
      ...(issue === "drain"
        ? {
            building: {
              use: "공동주택",
              structure: "철근콘크리트구조",
              approval: "19921014",
              floors: 15,
              checkedAt: "2026-11-05T00:00:00.000Z",
              repairHistory: "yes" as const,
              manager: "unknown" as const,
            },
            drain: {
              location: "other" as const,
              locationDetail: "베란다 배수구",
              scope: "single" as const,
              overflow: "no" as const,
              chemical: "yes" as const,
              attempted: "cleaned" as const,
            },
          }
        : {}),
    };
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
    if (issue === "drain") {
      const saved: import("../server/repositories/types.js").AnalysisRecord =
        (await repo.getAnalysis(guest.id, added.record.id))!;
      assert.deepEqual(saved.input.drain, input.drain);
      assert.equal(saved.result?.drainGuide?.route, "contact");
      const drainMember = randomUUID();
      await history.save(drainMember, saved, "점검 일정 확인 부탁드립니다.");
      const entries = await history.list(drainMember);
      assert.deepEqual(entries[0].input.drain, input.drain);
      assert.deepEqual(entries[0].input.building, input.building);
      assert.ok(
        entries[0].result.userReportedFacts.some((f) => f.key === "building"),
      );
      assert.deepEqual(entries[0].result.drainGuide, saved.result?.drainGuide);
      assert.equal(entries[0].result.messageDraft, saved.result?.messageDraft);
      if (input.building) {
        assert.equal(
          entries[0].result.buildingGuide?.version,
          "building-guide-1",
        );
        assert.deepEqual(
          entries[0].result.buildingGuide,
          saved.result?.buildingGuide,
        );
      }
      assert.equal((await history.list(randomUUID())).length, 0);
      await history.remove(drainMember, entries[0].id);
      assert.equal((await history.list(drainMember)).length, 0);
    }
    await repo.deleteGuest(guest.id);
  }
  pass(
    "expanded repair categories persist and delete under existing ownership rules",
  );
  const retriever = new PostgresKnowledgeRetriever(repo);
  for (const issue of [
    "mold",
    "leak",
    "boiler",
    "surface",
    "drain",
    "fixture",
  ] as const) {
    const knowledge = await retriever.retrieve(
      { ...defaultIntake, issue },
      new AbortController().signal,
    );
    assert.equal(knowledge.datasetVersion, datasetVersion);
    assert(knowledge.passages.length >= 2);
    assert(knowledge.passages.every((p) => p.source.issues.includes(issue)));
    if (issue === "mold")
      assert(!knowledge.passages.some((p) => p.claimId === "equipment-cause"));
  }
  const surface = {
    ...defaultIntake,
    issue: "surface" as const,
    observation: "floor-dent" as const,
  };
  const retrieved = await retriever.retrieve(
    surface,
    new AbortController().signal,
  );
  assert.equal(retrieved.passages[0].claimId, "initial-state");
  await assert.rejects(
    () =>
      new PostgresKnowledgeRetriever(repo!, true).retrieve(
        surface,
        new AbortController().signal,
      ),
    { code: "KNOWLEDGE_NOT_FOUND" },
  );
  await assert.rejects(() =>
    repo!.transaction("00000000-0000-4000-8000-000000000000", async (c) => {
      await c.query("delete from banglog_plus.knowledge_chunks");
    }),
  );
  await assert.rejects(() =>
    admin!.query("update banglog_plus.knowledge_chunks set claim='changed'"),
  );
  pass(
    "DB retrieval: six issue filters, symptom ranking, review gate and immutable read-only dataset",
  );

  let sdkCalls = 0;
  const kbConfig = loadConfig({
    REPOSITORY: "database",
    DATABASE_URL: url,
    DATABASE_SSL: "disable",
    AI_MODE: "live",
    OPENAI_API_KEY: "test-only",
    OPENAI_MODEL: "explicit-test-model",
    INTERNAL_LIVE_ENABLED: "true",
    PROVIDER_RETENTION_ACK: "true",
  });
  const kbRepo = new PostgresRepository(url, false);
  const client = new OpenAI({
    apiKey: "test-only",
    maxRetries: 0,
    fetch: async (_url, init) => {
      sdkCalls++;
      const body = JSON.parse(init?.body as string);
      const payload = JSON.parse(body.input);
      assert.equal(payload.datasetVersion, datasetVersion);
      const source = payload.sources.find(
        (s: { id: string }) => s.id === "2023da249661",
      );
      assert(source);
      assert(!JSON.stringify(payload).includes("2018da291347"));
      const text = JSON.stringify({
        direction: "undetermined",
        explanation:
          "현재 입력만으로 원인이나 비용 부담을 확정할 수 없어요. 입주 당시 상태와 점검 기록을 함께 확인해 주세요.",
        tailoredResponse: {
          summary:
            "입주 당시 상태와 점검 결과를 확인해야 비용 부담을 검토할 수 있어요.",
          steps: [
            {
              title: "입주 기록 확인",
              action:
                "입주 당시 기록과 현재 손상 위치를 비교해 집주인에게 전달해 보세요.",
              reason:
                "입주 당시 상태가 원상회복 범위에 중요하지만 토지 사건을 그대로 적용할 수는 없어요.",
              factKeys: ["contact", "preexisting"],
              missingEvidence: ["입주 사진"],
              claimIds: ["initial-state"],
            },
            {
              title: "수리 범위 확인",
              action:
                "부분 보수 가능 여부와 수리 견적을 요청해 기록을 남겨 보세요.",
              reason:
                "원상회복 범위를 확인할 자료가 필요하며 이번 비용을 확정하는 판결은 아니에요.",
              factKeys: ["observation"],
              missingEvidence: ["수리 견적"],
              claimIds: ["initial-state"],
            },
          ],
        },
        claimIds: ["initial-state"],
        sourceVersions: [{ sourceId: source.id, version: source.version }],
      });
      return new Response(
        JSON.stringify({
          id: "resp_db",
          object: "response",
          status: "completed",
          model: "explicit-test-model",
          output: [
            {
              id: "msg_db",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text, annotations: [] }],
            },
          ],
          usage: { input_tokens: 20, output_tokens: 20, total_tokens: 40 },
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  });
  const kbApp = createApp({
    config: kbConfig,
    repository: kbRepo,
    provider: new OpenAIAnalysisProvider(
      kbConfig,
      client,
      new PostgresKnowledgeRetriever(kbRepo),
    ),
  }).app;
  try {
    const session = await kbApp.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { noticeAccepted: true, consentVersion },
    });
    assert.equal(session.statusCode, 201);
    const headers = { authorization: `Bearer ${session.json().token}` };
    const response = await kbApp.inject({
      method: "POST",
      url: "/api/analyses",
      headers,
      payload: { intake: surface, idempotencyKey: randomUUID() },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().citedClaims[0].sourceId, "2023da249661");
    assert.equal(response.json().retrieval.datasetVersion, datasetVersion);
    assert.equal(sdkCalls, 1);
    const saved = await admin.query(
      "select result->'retrieval' as retrieval from banglog_plus.analysis_results where analysis_id=$1",
      [response.json().analysisId],
    );
    assert.equal(saved.rows[0].retrieval.chunks[0].sourceId, "2023da249661");
    await kbApp.inject({ method: "DELETE", url: "/api/session", headers });
  } finally {
    await kbApp.close();
  }
  pass(
    "API to real PostgreSQL retrieval to stubbed SDK to validated citations and persisted retrieval trace",
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
  const photoRepo = new PostgresRepository(url, false);
  let reads = 0;
  const photoApp = createApp({
    config: loadConfig({
      REPOSITORY: "database",
      DATABASE_URL: url,
      DATABASE_SSL: "disable",
    }),
    repository: photoRepo,
    readPhoto: async () => {
      if (++reads === 1) throw Error("test timeout");
      return {
        source: "mock",
        status: "analyzed",
        count: 1,
        signs: ["tear"],
        observations: [
          {
            status: "observed",
            visualSummary: "벽 모서리에서 찢어진 부분이 보여요.",
            signs: ["tear"],
            detectedErrorCode: null,
            detectedManufactureYear: null,
          },
        ],
        missingPhotoGuide: ["overview"],
      };
    },
  });
  try {
    const session = await photoApp.app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { noticeAccepted: true, consentVersion },
    });
    const headers = { authorization: `Bearer ${session.json().token}` };
    const guest = await photoRepo.authenticate(
      createHash("sha256").update(session.json().token).digest("hex"),
    );
    assert.ok(guest);
    const input = { ...surface, inputVersion: 1 };
    const photos = {
      consent: true,
      images: ["data:image/jpeg;base64,/9j/2Q=="],
      covered: ["before"],
    };
    const first = await photoApp.app.inject({
      method: "POST",
      url: "/api/analyses",
      headers,
      payload: { intake: input, idempotencyKey: randomUUID(), photos },
    });
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().photoAnalysis.status, "failed");
    const id = first.json().analysisId;
    const request = {
      method: "POST" as const,
      url: "/api/analyses",
      headers,
      payload: {
        intake: { ...input, inputVersion: 2 },
        idempotencyKey: id,
        photos,
        photoFollowup: { action: "retry", analysisId: id },
      },
    };
    const retry = await photoApp.app.inject(request);
    assert.equal(retry.statusCode, 200, retry.body);
    assert.equal(
      (await photoApp.app.inject(request)).json().analysisId,
      retry.json().analysisId,
    );
    assert.equal(reads, 2);
    const previous = await photoRepo.getAnalysis(guest.id, id);
    assert.equal(previous?.result?.photoAnalysis?.status, "failed");
    const saved = await photoRepo.getAnalysis(
      guest.id,
      retry.json().analysisId,
    );
    assert.ok(saved);
    const member = randomUUID();
    await history.save(member, saved, "기기에서 직접 수정한 문구");
    const [entry] = await history.list(member);
    assert.equal(
      entry.result.photoAnalysis?.observations?.[0].visualSummary,
      "벽 모서리에서 찢어진 부분이 보여요.",
    );
    assert.equal(entry.result.photoAnalysis?.retryAttempted, true);
    assert.equal(JSON.stringify(entry).includes("base64"), false);
  } finally {
    await photoApp.app.close();
  }
  pass(
    "photo retry idempotency after JSONB round trip, enriched member history and raw image exclusion",
  );
  const releaseRepo = new PostgresRepository(url, false);
  const ops = new Operations(releaseRepo);
  const memberId = randomUUID();
  await ops.member(memberId, "release-test@example.invalid", "email");
  const secret = "local-test-password-only";
  const salt = "release-test-salt";
  const release = createApp({
    repository: releaseRepo,
    config: loadConfig({
      REPOSITORY: "database",
      DATABASE_URL: url,
      DATABASE_SSL: "disable",
      PUBLIC_LAUNCH_ENABLED: "true",
      ADMIN_PASSWORD_HASH:
        salt + ":" + scryptSync(secret, salt, 64).toString("hex"),
      CRON_SECRET: "local-cron-secret",
    }),
  }).app;
  try {
    for (const path of [
      "dashboard",
      "knowledge",
      "members",
      "audit",
      "session",
    ])
      assert.equal(
        (await release.inject({ method: "GET", url: "/api/admin/" + path }))
          .statusCode,
        401,
      );
    assert.equal(
      (await release.inject({ method: "GET", url: "/api/cron/cleanup" }))
        .statusCode,
      401,
    );
    const publicResponse = await release.inject({
      method: "GET",
      url: "/api/public/dashboard",
    });
    assert.equal(publicResponse.statusCode, 200);
    const publicData = publicResponse.json();
    assert.deepEqual(Object.keys(publicData).sort(), [
      "answers",
      "checkedAt",
      "days",
      "knowledge",
      "usage",
      "version",
    ]);
    assert.equal(publicData.version, releaseVersion);
    assert.equal(publicData.knowledge.length, 7);
    assert.ok(!publicResponse.body.includes("release-test@example.invalid"));
    assert.ok(!publicResponse.body.includes(memberId));
    assert.ok(!publicResponse.body.includes("user_id"));
    assert.ok(!publicResponse.body.includes("token_hash"));
    for (const path of ["cleanup", "check", "members/" + memberId])
      assert.equal(
        (
          await release.inject({
            method: "POST",
            url: "/api/admin/" + path,
            headers: { "x-admin-request": "1" },
            payload: {
              action: "delete_history",
              reason: "unauthorized",
              confirm: true,
            },
          })
        ).statusCode,
        401,
      );
    assert.equal(
      (
        await release.inject({
          method: "POST",
          url: "/api/public/dashboard",
          payload: { action: "delete_history" },
        })
      ).statusCode,
      404,
    );
    pass(
      "public v1.3 dashboard exposes only aggregates and curated knowledge; private data and all mutations remain authenticated",
    );
    const status = await release.inject({ method: "GET", url: "/api/status" });
    assert.equal(status.json().knowledge.count, 7);
    assert.ok(!status.body.includes(secret));
    assert.equal(
      (
        await release.inject({
          method: "POST",
          url: "/api/admin/login",
          payload: { password: secret },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await release.inject({
          method: "POST",
          url: "/api/admin/login",
          headers: { "x-admin-request": "1", origin: "https://evil.example" },
          payload: { password: secret },
        })
      ).statusCode,
      403,
    );
    const login = await release.inject({
      method: "POST",
      url: "/api/admin/login",
      headers: { "x-admin-request": "1" },
      payload: { password: secret },
    });
    assert.equal(login.statusCode, 200);
    const setCookie = String(login.headers["set-cookie"]);
    for (const flag of ["HttpOnly", "Secure", "SameSite=Strict"])
      assert.ok(setCookie.includes(flag));
    const headers = { cookie: setCookie.split(";")[0], "x-admin-request": "1" };
    const dashboard = await release.inject({
      method: "GET",
      url: "/api/admin/dashboard",
      headers,
    });
    assert.equal(dashboard.statusCode, 200);
    assert.equal(
      (
        await release.inject({
          method: "GET",
          url: "/api/admin/knowledge",
          headers,
        })
      ).json().length,
      7,
    );
    const mutate = (payload: object) =>
      release.inject({
        method: "POST",
        url: "/api/admin/members/" + memberId,
        headers,
        payload,
      });
    assert.equal(
      (await mutate({ action: "block", reason: "test" })).statusCode,
      400,
    );
    assert.equal(
      (
        await mutate({
          action: "block",
          reason: "test restriction",
          confirm: true,
        })
      ).statusCode,
      200,
    );
    await assert.rejects(() => ops.member(memberId), /MEMBER_BLOCKED/);
    assert.equal(
      (
        await mutate({
          action: "unblock",
          reason: "test restored",
          confirm: true,
        })
      ).statusCode,
      200,
    );
    await ops.member(memberId);
    const audit = (
      await release.inject({ method: "GET", url: "/api/admin/audit", headers })
    ).json();
    assert.ok(audit.some((x: { action: string }) => x.action === "block"));
    const governanceResponse = await release.inject({
      method: "GET",
      url: "/api/admin/data-governance",
      headers,
    });
    assert.equal(governanceResponse.statusCode, 200);
    assert.equal(governanceResponse.json().eligibility.public_eligible, 0);
    assert.equal(
      (
        await release.inject({
          method: "GET",
          url: "/api/admin/data-governance",
        })
      ).statusCode,
      401,
    );
    await release.inject({ method: "POST", url: "/api/admin/logout", headers });
    assert.equal(
      (
        await release.inject({
          method: "GET",
          url: "/api/admin/session",
          headers,
        })
      ).statusCode,
      401,
    );
    pass(
      "admin authentication, CSRF, secure cookie, aggregate reads, confirmed member restriction, audit and logout revocation",
    );
    await ops.rate("durable-test", 1, 60000);
    await assert.rejects(
      () => new Operations(releaseRepo).rate("durable-test", 1, 60000),
      /RATE_LIMIT/,
    );
    const lease = await ops.lease(1);
    await assert.rejects(
      () => new Operations(releaseRepo).lease(1),
      /CONCURRENCY_LIMIT/,
    );
    await ops.release(lease);
    await ops.release(await ops.lease(1));
    pass("durable rate and concurrency limits across operation instances");
  } finally {
    await release.close();
  }
  await admin.query(
    await readFile("data/research/2026-11-05/import.sql", "utf8"),
  );
  await admin.query(
    await readFile("data/research/2026-11-05/import.sql", "utf8"),
  );
  assert.equal(
    Number(
      (
        await admin.query(
          "select count(*) from banglog_plus.evidence_candidates",
        )
      ).rows[0].count,
    ),
    12,
  );
  await assert.rejects(
    () =>
      admin!.query(`insert into banglog_plus.evidence_candidates
    (id,dataset_id,source_row,document_type,title,payload,content_sha256,file_sha256,review_note)
    values ('forbidden','aihub-71841','test','judgment','test','{}',repeat('a',64),repeat('b',64),'test')`),
    /DATASET_STORAGE_NOT_ALLOWED/,
  );
  await assert.rejects(
    () =>
      repo!.transaction("", async (c) => {
        await c.query("select * from banglog_plus.evidence_candidates");
      }),
    /permission denied/,
  );
  pass(
    "public data: idempotent 12-candidate import, AI Hub storage denied, app role cannot read quarantine",
  );
  const research = await evaluateResearchRetrieval(repo);
  assert.equal(research.cases.length, 12);
  assert(research.cases.every((c) => !c.publicEligible));
  assert.equal(
    research.cases.find((c) => c.id === "B2")?.status,
    "safety_priority",
  );
  assert.equal(research.cases.find((c) => c.id === "D2")?.drainRoute, "stop");
  assert.equal(
    research.cases.find((c) => c.id === "D1")?.drainRoute,
    "self_check",
  );
  pass(
    "12 synthetic research scenarios: retrieval traces, public eligibility and danger stop, no GPT call",
  );
  // Synthetic approved source exists ONLY in this disposable test database.
  const synthetic = {
    ...sources[0],
    id: "governance-fixture",
    version: "test",
    humanLegalReview: "approved",
    use: "public",
  };
  await admin.query(
    "insert into banglog_plus.legal_sources values($1,$2,$3,$4)",
    [synthetic.id, synthetic.title, synthetic.institution, synthetic.url],
  );
  await admin.query(
    `insert into banglog_plus.legal_source_versions(source_id,version,location,checked_at,technical_status,human_legal_review,use_scope,metadata)
    values($1,'test',$2,current_date,'verified','approved','public',$3)`,
    [synthetic.id, synthetic.location, synthetic],
  );
  await admin.query(
    `insert into banglog_plus.knowledge_chunks values('governance-fixture',$1,$2,'test','test','테스트용 명제','테스트용 근거',array['mold'],array[]::text[],array[]::text[])`,
    [datasetVersion, synthetic.id],
  );
  const publicRetriever = new PostgresKnowledgeRetriever(repo, true);
  const lookup = () =>
    publicRetriever.retrieve(defaultIntake, new AbortController().signal);
  await assert.rejects(lookup, { code: "KNOWLEDGE_NOT_FOUND" });
  await admin.query(
    `insert into banglog_plus.source_permissions values($1,'test',true,'https://example.com/permission','synthetic-test',now()-interval '1 day',now()+interval '1 day',null)`,
    [synthetic.id],
  );
  assert.equal((await lookup()).passages[0].source.id, synthetic.id);
  await admin.query(
    "update banglog_plus.source_permissions set revoked_at=now() where source_id=$1",
    [synthetic.id],
  );
  await assert.rejects(lookup, { code: "KNOWLEDGE_NOT_FOUND" });
  await admin.query(
    "update banglog_plus.source_permissions set revoked_at=null,expires_at=now()-interval '1 hour' where source_id=$1",
    [synthetic.id],
  );
  await assert.rejects(lookup, { code: "KNOWLEDGE_NOT_FOUND" });
  pass(
    "public retrieval requires expert approval and active external-AI permission; missing, revoked, expired denied",
  );
  await admin.query(await readFile("data/official-statutes.v2.sql", "utf8"));
  await admin.query(await readFile("data/official-statutes.v2.sql", "utf8"));
  const surfaceKnowledge = await new PostgresKnowledgeRetriever(
    repo,
    true,
  ).retrieve(
    {
      ...defaultIntake,
      issue: "surface",
      description: "퇴실 보증금 공제 원상회복 벽지 장판 특약",
    },
    new AbortController().signal,
  );
  assert(surfaceKnowledge.passages.some((p) => p.source.id === "civil-615"));
  assert(surfaceKnowledge.passages.some((p) => p.source.id === "civil-654"));
  pass(
    "surface restoration retrieves both 615 and 654 without expert-approval claims",
  );
  const official = await lookup();
  assert.equal(official.passages.length, 3);
  assert(
    official.passages.every(
      (p) =>
        p.source.humanLegalReview === "pending" &&
        p.source.reviewBasis === "official_statute",
    ),
  );
  await admin.query(
    "update banglog_plus.source_permissions set revoked_at=now() where source_version in ('2026-03-17.official-2026-11-10.v1','2026-03-17.official-2026-11-11.v2')",
  );
  await assert.rejects(lookup, { code: "KNOWLEDGE_NOT_FOUND" });
  await admin.query(
    "update banglog_plus.source_permissions set revoked_at=null,expires_at=now()-interval '1 hour' where source_version in ('2026-03-17.official-2026-11-10.v1','2026-03-17.official-2026-11-11.v2')",
  );
  await assert.rejects(lookup, { code: "KNOWLEDGE_NOT_FOUND" });
  pass(
    "official statutory general guidance: 3 exact verified chunks, idempotent insert, human approval remains pending; revoked/expired permissions block retrieval",
  );
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
