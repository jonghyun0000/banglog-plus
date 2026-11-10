import pg from "pg";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Analysis, Feedback, Intake } from "../../shared/schema.js";
import { questionVersion } from "../../shared/questions.js";
import { AppError } from "../domain/errors.js";
import type {
  AnalysisRecord,
  BudgetLimits,
  Guest,
  Metric,
  Repository,
} from "./types.js";
export class PostgresRepository implements Repository {
  kind = "database" as const;
  pool: pg.Pool;
  constructor(url: string, ssl = true) {
    this.pool = new pg.Pool({
      connectionString: url,
      ssl: ssl
        ? {
            rejectUnauthorized: true,
            ca: readFileSync("data/supabase-ca.crt", "utf8"),
          }
        : false,
      max: process.env.VERCEL ? 3 : 8,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
  }
  async verifyReady() {
    await this.transaction(
      "00000000-0000-4000-8000-000000000000",
      async (c) => {
        await c.query("select id from banglog_plus.analysis_sessions limit 0");
        const sources = await c.query(
          "select source_id from banglog_plus.legal_source_versions where technical_status='verified'",
        );
        if (!sources.rowCount) throw new AppError("CONFIG_NOT_READY", 503);
      },
    );
  }
  async transaction<T>(
    owner: string,
    fn: (c: pg.PoolClient) => Promise<T>,
    hash = "",
  ): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      await c.query("set local role banglog_plus_server");
      await c.query(
        "select set_config('banglog.guest_id',$1,true),set_config('banglog.token_hash',$2,true)",
        [owner, hash],
      );
      const result = await fn(c);
      await c.query("commit");
      return result;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }
  private async active(c: pg.PoolClient, owner: string) {
    const q = await c.query(
      "select id from banglog_plus.guest_sessions where id=$1 and expires_at>now() and revoked_at is null for update",
      [owner],
    );
    if (!q.rowCount) throw new AppError("UNAUTHORIZED", 401);
  }
  async createGuest(hash: string, consent: string): Promise<Guest> {
    const id = randomUUID();
    return this.transaction(id, async (c) => {
      const q = await c.query(
        "insert into banglog_plus.guest_sessions(id,token_hash,expires_at,consent_version) values($1,$2,now()+interval '24 hours',$3) returning *",
        [id, hash, consent],
      );
      return {
        id,
        tokenHash: hash,
        expiresAt: new Date(q.rows[0].expires_at).getTime(),
        consentVersion: consent,
      };
    });
  }
  async authenticate(hash: string): Promise<Guest | null> {
    return this.transaction(
      "",
      async (c) => {
        const q = await c.query(
          "select * from banglog_plus.guest_sessions where token_hash=$1 and expires_at>now() and revoked_at is null",
          [hash],
        );
        const g = q.rows[0];
        return g
          ? {
              id: g.id,
              tokenHash: g.token_hash,
              expiresAt: new Date(g.expires_at).getTime(),
              consentVersion: g.consent_version,
            }
          : null;
      },
      hash,
    );
  }
  private row(r: Record<string, unknown>): AnalysisRecord {
    return {
      id: r.id as string,
      owner: r.guest_id as string,
      key: r.idempotency_key as string,
      digest: r.input_digest as string,
      input: r.input as Intake,
      state: r.state as AnalysisRecord["state"],
      result: (r.result as Analysis | null) ?? null,
      failureCode: r.failure_code as string | null,
    };
  }
  async createAnalysis(
    owner: string,
    key: string,
    digest: string,
    input: Intake,
  ) {
    return this.transaction(owner, async (c) => {
      await this.active(c, owner);
      const previous = await c.query(
        "select a.*,r.result from banglog_plus.analysis_sessions a left join banglog_plus.analysis_results r on r.analysis_id=a.id where a.guest_id=$1 and (a.idempotency_key=$2 or a.input_version=$3)",
        [owner, key, input.inputVersion],
      );
      if (previous.rowCount) {
        const record = this.row(previous.rows[0]);
        if (record.digest !== digest)
          throw new AppError("IDEMPOTENCY_CONFLICT", 409);
        return { record, created: false };
      }
      const id = randomUUID();
      const q = await c.query(
        "insert into banglog_plus.analysis_sessions(id,guest_id,issue,input_version,idempotency_key,input_digest,input,state) values($1,$2,$3,$4,$5,$6,$7,'pending') returning *",
        [id, owner, input.issue, input.inputVersion, key, digest, input],
      );
      await c.query(
        "insert into banglog_plus.question_answers values($1,$2,$3,$4)",
        [id, owner, questionVersion, input],
      );
      return { record: this.row(q.rows[0]), created: true };
    });
  }
  async getAnalysis(owner: string, id: string) {
    return this.transaction(owner, async (c) => {
      await this.active(c, owner);
      const q = await c.query(
        "select a.*,r.result from banglog_plus.analysis_sessions a left join banglog_plus.analysis_results r on r.analysis_id=a.id where a.id=$1 and a.guest_id=$2",
        [id, owner],
      );
      return q.rowCount ? this.row(q.rows[0]) : null;
    });
  }
  async finish(owner: string, id: string, result: Analysis) {
    try {
      return await this.transaction(owner, async (c) => {
        await this.active(c, owner);
        const q = await c.query(
          "update banglog_plus.analysis_sessions set state='complete' where id=$1 and guest_id=$2 and state='pending' returning id",
          [id, owner],
        );
        if (!q.rowCount) return false;
        await c.query(
          "insert into banglog_plus.analysis_results values($1,$2,$3,$4,$5,$6,$7)",
          [
            id,
            owner,
            result.inputVersion,
            result,
            result.ruleVersion,
            result.promptVersion,
            result.model,
          ],
        );
        await c.query("insert into banglog_plus.case_facts values($1,$2,$3)", [
          id,
          owner,
          {
            reported: result.userReportedFacts,
            unknown: result.unknownFacts,
            conflicting: result.conflictingFacts,
          },
        ]);
        for (const s of result.citedClaims)
          await c.query(
            "insert into banglog_plus.result_sources values($1,$2,$3,$4,$5,$6)",
            [id, owner, s.sourceId, s.sourceVersion, s.claim, s.location],
          );
        await c.query(
          `insert into banglog_plus.usage_daily_summary(day,issue,observation,direction,mode)
          select (now() at time zone 'Asia/Seoul')::date,issue,input->>'observation',$3,$4 from banglog_plus.analysis_sessions where id=$1 and guest_id=$2
          on conflict(day,issue,observation,direction,mode) do update set completed=banglog_plus.usage_daily_summary.completed+1`,
          [id, owner, result.costResponsibility.direction, result.mode],
        );
        await c.query(
          `insert into banglog_plus.answer_daily_summary(day,issue,question,answer,mode)
          select (now() at time zone 'Asia/Seoul')::date,a.issue,choice.key,choice.value,$3
          from banglog_plus.analysis_sessions a cross join lateral jsonb_each_text(a.input) choice
          where a.id=$1 and a.guest_id=$2 and choice.key in ('observation','discovered','preexisting','installed','cause','causeSource','otherClaim','contact','safety')
          on conflict(day,issue,question,answer,mode) do update set completed=banglog_plus.answer_daily_summary.completed+1`,
          [id, owner, result.mode],
        );
        return true;
      });
    } catch (e) {
      if (e instanceof AppError && e.code === "UNAUTHORIZED") return false;
      throw e;
    }
  }
  async fail(owner: string, id: string, code: string) {
    await this.transaction(owner, async (c) => {
      await c.query(
        "update banglog_plus.analysis_sessions set state='failed',failure_code=$3 where id=$1 and guest_id=$2 and state='pending'",
        [id, owner, code],
      );
    });
  }
  async cancel(owner: string, key: string) {
    await this.transaction(owner, async (c) => {
      await this.active(c, owner);
      await c.query(
        "update banglog_plus.analysis_sessions set state='cancelled' where guest_id=$1 and idempotency_key=$2 and state='pending'",
        [owner, key],
      );
    });
  }
  async deleteGuest(owner: string) {
    await this.transaction(owner, async (c) => {
      await c.query(
        "select id from banglog_plus.guest_sessions where id=$1 for update",
        [owner],
      );
      await c.query("delete from banglog_plus.guest_sessions where id=$1", [
        owner,
      ]);
    });
  }
  async feedback(owner: string, id: string, data: Feedback) {
    await this.transaction(owner, async (c) => {
      await this.active(c, owner);
      const q = await c.query(
        "select analysis_id from banglog_plus.analysis_results where analysis_id=$1 and guest_id=$2",
        [id, owner],
      );
      if (!q.rowCount) throw new AppError("NOT_FOUND", 404);
      await c.query(
        "insert into banglog_plus.feedback_events values($1,$2,$3,$4,$5) on conflict(analysis_id) do update set helpful=excluded.helpful,understood=excluded.understood,error_type=excluded.error_type",
        [id, owner, data.helpful, data.understood, data.errorType],
      );
    });
  }
  async metric(owner: string, data: Metric) {
    await this.transaction(owner, async (c) => {
      await this.active(c, owner);
      await c.query(
        "insert into banglog_plus.usage_metrics values($1,$2,$3,$4,$5,$6,now()) on conflict do nothing",
        [
          randomUUID(),
          owner,
          data.analysisId ?? null,
          data.event,
          data.mode,
          data,
        ],
      );
    });
  }
  async reserve(tokens: number, usd: number | null, limits: BudgetLimits) {
    await this.transaction("", async (c) => {
      await c.query("select pg_advisory_xact_lock(181903,1)");
      await c.query(
        "insert into banglog_plus.budget_ledger values(current_date,0,0,0) on conflict do nothing",
      );
      const q = await c.query(
        "update banglog_plus.budget_ledger set calls=calls+1,tokens=tokens+$1,usd=usd+$2 where day=current_date and calls+1<=$3 and tokens+$1<=$4 and ($5::numeric is null or usd+$2<=$5) returning day",
        [tokens, usd ?? 0, limits.calls, limits.tokens, limits.usd],
      );
      if (!q.rowCount) throw new AppError("BUDGET_LIMIT", 429);
    });
  }
  async cleanup() {
    return this.transaction("", async (c) => {
      await c.query("select set_config('banglog.cleanup','true',true)");
      await c.query(
        "delete from banglog_plus.member_history where expires_at<=now()",
      );
      const q = await c.query(
        "delete from banglog_plus.guest_sessions where expires_at<=now() or revoked_at is not null",
      );
      return q.rowCount ?? 0;
    });
  }
  async seedSources() {}
  async close() {
    await this.pool.end();
  }
}
