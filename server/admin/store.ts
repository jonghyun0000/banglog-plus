import type { PoolClient } from "pg";
import type { PostgresRepository } from "../repositories/postgres.js";
import { AppError } from "../domain/errors.js";
import { datasetVersion } from "../sources/dataset.js";
import {
  officialDatasetVersion,
  isVerifiedOfficialRow,
} from "../sources/official.js";
export class AdminStore {
  constructor(readonly repo: PostgresRepository) {}
  async run<T>(work: (c: PoolClient) => Promise<T>) {
    const c = await this.repo.pool.connect();
    try {
      await c.query("begin");
      await c.query("set local role banglog_plus_admin");
      const r = await work(c);
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }
  async audit(
    action: string,
    target: string | null = null,
    reason: string | null = null,
  ) {
    await this.run((c) =>
      c.query(
        "insert into banglog_plus.admin_audit(action,target,reason) values($1,$2,$3)",
        [action, target, reason],
      ),
    );
  }
  async session(hash: string) {
    return this.run(
      async (c) =>
        (
          await c.query(
            "select 1 from banglog_plus.admin_sessions where token_hash=$1 and expires_at>now()",
            [hash],
          )
        ).rowCount === 1,
    );
  }
  async login(hash: string) {
    await this.run(async (c) => {
      await c.query(
        "delete from banglog_plus.admin_sessions where expires_at<=now()",
      );
      await c.query(
        "insert into banglog_plus.admin_sessions(token_hash,expires_at) values($1,now()+interval '8 hours')",
        [hash],
      );
      await c.query(
        "insert into banglog_plus.admin_audit(action) values('login')",
      );
    });
  }
  async logout(hash: string) {
    await this.run(async (c) => {
      await c.query(
        "delete from banglog_plus.admin_sessions where token_hash=$1",
        [hash],
      );
      await c.query(
        "insert into banglog_plus.admin_audit(action) values('logout')",
      );
    });
  }
  async dashboard(days: number) {
    return this.run(async (c) => {
      const usage = await c.query(
        "select day::text,issue,mode,sum(completed)::int as count from banglog_plus.usage_daily_summary where day>=(now() at time zone 'Asia/Seoul')::date-($1::int-1) group by day,issue,mode order by day desc,issue",
        [days],
      );
      const answers = await c.query(
        "select issue,question,answer,sum(completed)::int as count from banglog_plus.answer_daily_summary where day>=(now() at time zone 'Asia/Seoul')::date-($1::int-1) group by issue,question,answer order by issue,question,count desc",
        [days],
      );
      const operations = await c.query(
        "select kind,code,count(*)::int as count,round(avg(latency_ms))::int as latency from banglog_plus.operational_events where created_at>=now()-make_interval(days=>$1) group by kind,code order by count desc",
        [days],
      );
      const budget = await c.query(
        "select day::text,calls,tokens,usd::text from banglog_plus.budget_ledger order by day desc limit 7",
      );
      const members = await c.query(
        "select count(*)::int as total,count(*) filter(where status='blocked')::int as blocked from banglog_plus.members",
      );
      return {
        usage: usage.rows,
        answers: answers.rows,
        operations: operations.rows,
        budget: budget.rows,
        members: members.rows[0],
        days,
      };
    });
  }
  async publicSummary() {
    return this.run(async (c) => {
      const usage = await c.query(
        "select day::text,issue,mode,sum(completed)::int as count from banglog_plus.usage_daily_summary where day>=(now() at time zone 'Asia/Seoul')::date-29 group by day,issue,mode order by day desc,issue",
      );
      const answers = await c.query(
        "select issue,question,answer,sum(completed)::int as count from banglog_plus.answer_daily_summary where day>=(now() at time zone 'Asia/Seoul')::date-29 group by issue,question,answer order by issue,question,count desc",
      );
      return { usage: usage.rows, answers: answers.rows };
    });
  }
  async governance() {
    return this.run(async (c) => {
      const datasets = await c.query(
        "select id,title,provider,catalog_url,license_status,storage_allowed,external_llm_allowed,purpose,limitation,checked_at from banglog_plus.dataset_registry order by id",
      );
      const candidates = await c.query(
        "select dataset_id,document_type,review_status,count(*)::int as count from banglog_plus.evidence_candidates group by 1,2,3 order by 1,2,3",
      );
      const eligibility = await c.query(
        `select count(*)::int as versions,
          count(*) filter(where v.human_legal_review='approved' and v.use_scope='public'
            and v.technical_status='verified' and p.external_llm_allowed
            and p.revoked_at is null and p.checked_at<=now() and p.expires_at>now())::int as public_eligible
         from banglog_plus.legal_source_versions v
         left join banglog_plus.source_permissions p on (p.source_id,p.source_version)=(v.source_id,v.version)`,
      );
      const official = await c.query(
        `select k.id,k.dataset_version,k.issues,k.claim_id,k.claim,k.content,
        k.source_id,k.source_version,v.metadata as source,v.technical_status,v.human_legal_review,v.use_scope
        from banglog_plus.knowledge_chunks k join banglog_plus.legal_source_versions v
        on (v.source_id,v.version)=(k.source_id,k.source_version)
        join banglog_plus.source_permissions p on (p.source_id,p.source_version)=(v.source_id,v.version)
        where k.dataset_version=$1 and p.external_llm_allowed and p.revoked_at is null
        and p.checked_at<=now() and p.expires_at>now()`,
        [officialDatasetVersion],
      );
      return {
        datasets: datasets.rows,
        candidates: candidates.rows,
        eligibility: {
          ...eligibility.rows[0],
          official_general: official.rows.filter(isVerifiedOfficialRow).length,
        },
      };
    });
  }
  async knowledge() {
    return this.run(
      async (c) =>
        (
          await c.query(
            "select k.id,k.claim,k.content,k.issues,v.metadata as source from banglog_plus.knowledge_chunks k join banglog_plus.legal_source_versions v on (v.source_id,v.version)=(k.source_id,k.source_version) where k.dataset_version=any($1::text[]) order by k.source_id",
            [[datasetVersion, officialDatasetVersion]],
          )
        ).rows,
    );
  }
  async members(search: string, page: number) {
    return this.run(async (c) => {
      const term = "%" + search.replace(/[\\%_]/g, "\\$&") + "%";
      const where = "where (m.email ilike $1 or m.user_id::text ilike $1)";
      const count = await c.query(
        "select count(*)::int as total from banglog_plus.members m " + where,
        [term],
      );
      const rows = await c.query(
        "select m.*, (select count(*)::int from banglog_plus.member_history h where h.user_id=m.user_id and h.expires_at>now()) as history_count from banglog_plus.members m " +
          where +
          " order by m.last_seen_at desc limit 30 offset $2",
        [term, (page - 1) * 30],
      );
      return { items: rows.rows, total: count.rows[0].total, page };
    });
  }
  async changeMember(
    id: string,
    action: "block" | "unblock" | "delete_history",
    reason: string,
  ) {
    await this.run(async (c) => {
      const m = await c.query(
        "select user_id from banglog_plus.members where user_id=$1 for update",
        [id],
      );
      if (!m.rowCount) throw new AppError("NOT_FOUND", 404);
      if (action === "delete_history")
        await c.query(
          "delete from banglog_plus.member_history where user_id=$1",
          [id],
        );
      else
        await c.query(
          "update banglog_plus.members set status=$2 where user_id=$1",
          [id, action === "block" ? "blocked" : "active"],
        );
      await c.query(
        "insert into banglog_plus.admin_audit(action,target,reason) values($1,$2,$3)",
        [action, id, reason],
      );
    });
  }
  async logs() {
    return this.run(
      async (c) =>
        (
          await c.query(
            "select action,target,reason,created_at from banglog_plus.admin_audit order by id desc limit 100",
          )
        ).rows,
    );
  }
}
