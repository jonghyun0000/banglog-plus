import { passesRepairTeamReview } from "./team-review.js";
import { z } from "zod";
import { sourceSchema, type Intake } from "../../shared/schema.js";
import type { PostgresRepository } from "../repositories/postgres.js";
import { answerLabel, observationLabel } from "../../shared/questions.js";
import { AppError } from "../domain/errors.js";
import { datasetVersion } from "./dataset.js";
import { officialDatasetVersion, isVerifiedOfficialRow } from "./official.js";

export const knowledgeSchema = z.object({
  datasetVersion: z.string().max(100),
  method: z.literal("postgres-filter-keyword-1"),
  passages: z
    .array(
      z.object({
        id: z.string().max(100),
        claimId: z.string().max(100),
        text: z.string().min(1).max(2400),
        claim: z.string().min(1).max(800),
        source: sourceSchema,
      }),
    )
    .min(1)
    .max(4),
});
export type RetrievedKnowledge = z.infer<typeof knowledgeSchema>;
export interface KnowledgeRetriever {
  retrieve(input: Intake, signal: AbortSignal): Promise<RetrievedKnowledge>;
}

export class PostgresKnowledgeRetriever implements KnowledgeRetriever {
  constructor(
    private repo: PostgresRepository,
    private publicUse = false,
  ) {}
  async retrieve(
    input: Intake,
    signal: AbortSignal,
  ): Promise<RetrievedKnowledge> {
    if (signal.aborted) throw new AppError("CANCELLED", 409);
    const rows = await this.repo.transaction(
      "00000000-0000-4000-8000-000000000000",
      async (c) =>
        (
          await c.query(
            `select k.id, k.claim_id, k.content, k.claim, v.metadata as source,
                k.source_id, k.source_version, v.technical_status,
                v.human_legal_review, v.use_scope, k.dataset_version, k.issues
         from banglog_plus.knowledge_chunks k
         join banglog_plus.legal_source_versions v
           on v.source_id=k.source_id and v.version=k.source_version
         where k.dataset_version=any($1::text[]) and k.issues @> array[$2]::text[]
           and v.technical_status='verified'
           and (not $5 or (((v.human_legal_review='approved' and v.use_scope='public') or (k.dataset_version=$6 and v.use_scope='general'))
             and exists (select 1 from banglog_plus.source_permissions permission
               where permission.source_id=v.source_id and permission.source_version=v.version
                 and permission.external_llm_allowed and permission.revoked_at is null
                 and permission.checked_at<=now() and permission.expires_at>now())))
         order by (case when $3=any(k.observations) then 10 else 0 end
             + (select count(*) from unnest(k.keywords) word
                where position(word in $4)>0)) desc, k.id
         limit 4`,
            [
              [datasetVersion, officialDatasetVersion],
              input.issue,
              input.observation,
              [
                input.description,
                input.contract,
                observationLabel(input),
                answerLabel("contact", input.contact),
                answerLabel("cause", input.cause),
                answerLabel("otherClaim", input.otherClaim),
                answerLabel("preexisting", input.preexisting),
              ]
                .join(" ")
                .slice(0, 2000),
              this.publicUse,
              officialDatasetVersion,
            ],
          )
        ).rows,
    );
    if (signal.aborted) throw new AppError("CANCELLED", 409);
    if (!rows.length) throw new AppError("KNOWLEDGE_NOT_FOUND", 422);
    const parsed = knowledgeSchema.safeParse({
      datasetVersion: rows.some(
        (r) => r.dataset_version === officialDatasetVersion,
      )
        ? officialDatasetVersion
        : datasetVersion,
      method: "postgres-filter-keyword-1",
      passages: rows.map((r) => ({
        id: r.id,
        claimId: r.claim_id,
        text: r.content,
        claim: r.claim,
        source: r.source,
      })),
    });
    if (
      !parsed.success ||
      rows.some((r, index) => {
        const s = parsed.data?.passages[index]?.source;
        return (
          !passesRepairTeamReview(r.source_id) ||
          (r.dataset_version === officialDatasetVersion &&
            !isVerifiedOfficialRow(r)) ||
          !s ||
          s.id !== r.source_id ||
          s.version !== r.source_version ||
          s.technicalStatus !== r.technical_status ||
          s.humanLegalReview !== r.human_legal_review ||
          s.use !== r.use_scope ||
          !s.issues.includes(input.issue)
        );
      })
    )
      throw new AppError("KNOWLEDGE_INVALID", 503);
    return parsed.data;
  }
}
