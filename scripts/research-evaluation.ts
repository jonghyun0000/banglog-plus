import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { defaultIntake, intakeSchema } from "../shared/schema.js";
import { makeAnalysis } from "../shared/analysis.js";
import { PostgresKnowledgeRetriever } from "../server/sources/retrieval.js";
import type { PostgresRepository } from "../server/repositories/postgres.js";
import { datasetVersion } from "../server/sources/dataset.js";

// Called only by the disposable PostgreSQL integration suite. No GPT calls.
export async function evaluateResearchRetrieval(repo: PostgresRepository) {
  const cases = JSON.parse(
    await readFile("data/research/2026-11-05/evaluation-12.json", "utf8"),
  ) as Array<{ id: string; label: string; input: unknown }>;
  const output = [];
  for (const c of cases) {
    const input = intakeSchema.parse({
      ...defaultIntake,
      ...(c.input as object),
    });
    const software = makeAnalysis(
      input,
      randomUUID(),
      "mock",
      "research-software-check",
    );
    let keywordIds: string[] = [],
      issueOnlyIds: string[] = [];
    if (software.status !== "safety_priority") {
      const current = await new PostgresKnowledgeRetriever(repo).retrieve(
        input,
        new AbortController().signal,
      );
      keywordIds = current.passages.map((p) => p.id);
      issueOnlyIds = await repo.transaction(
        "00000000-0000-4000-8000-000000000000",
        async (client) =>
          (
            await client.query(
              "select id from banglog_plus.knowledge_chunks where dataset_version=$1 and issues @> array[$2]::text[] order by id limit 4",
              [datasetVersion, input.issue],
            )
          ).rows.map((r) => r.id),
      );
    }
    let publicEligible = false;
    if (software.status !== "safety_priority") {
      try {
        await new PostgresKnowledgeRetriever(repo, true).retrieve(
          input,
          new AbortController().signal,
        );
        publicEligible = true;
      } catch (e) {
        if (!(e instanceof Error) || e.message !== "KNOWLEDGE_NOT_FOUND")
          throw e;
      }
    }
    output.push({
      id: c.id,
      label: c.label,
      status: software.status,
      issueOnlyIds,
      keywordIds,
      publicEligible,
      drainRoute: software.drainGuide?.route ?? null,
    });
  }
  const report = {
    checkedAt: new Date().toISOString(),
    database: "disposable_local_postgres",
    datasetVersion,
    cases: output,
    modelCalls: 0,
    legalAccuracy: null,
    expertEvaluation: "not_performed",
    note: "검색 결과와 안전 분기를 확인한 소프트웨어 실험. GPT 답변 품질·법률 정확도·통계적 우월성을 검증한 결과가 아닙니다.",
  };
  await writeFile(
    "data/research/2026-11-05/retrieval-check.json",
    JSON.stringify(report, null, 2),
  );
  return report;
}
