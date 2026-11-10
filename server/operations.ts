import { randomUUID } from "node:crypto";
import type { PostgresRepository } from "./repositories/postgres.js";
import { AppError } from "./domain/errors.js";
export class Operations {
  constructor(readonly repo: PostgresRepository) {}
  async rate(key: string, max: number, windowMs: number) {
    await this.repo.transaction("", async (c) => {
      const r = await c.query(
        `insert into banglog_plus.rate_limits(key,count,expires_at) values($1,1,now()+$3::int*interval '1 millisecond') on conflict(key) do update set count=case when rate_limits.expires_at<=now() then 1 else rate_limits.count+1 end, expires_at=case when rate_limits.expires_at<=now() then excluded.expires_at else rate_limits.expires_at end returning count,$2::int as maximum`,
        [key, max, windowMs],
      );
      if (r.rows[0].count > max) throw new AppError("RATE_LIMIT", 429);
    });
  }
  async lease(max: number) {
    return this.repo.transaction("", async (c) => {
      await c.query("select pg_advisory_xact_lock(181903,3)");
      await c.query(
        "delete from banglog_plus.analysis_leases where expires_at<=now()",
      );
      const q = await c.query(
        "select count(*)::int as n from banglog_plus.analysis_leases",
      );
      if (q.rows[0].n >= max) throw new AppError("CONCURRENCY_LIMIT", 429);
      const id = randomUUID();
      await c.query(
        "insert into banglog_plus.analysis_leases values($1,now()+interval '60 seconds')",
        [id],
      );
      return id;
    });
  }
  async release(id: string) {
    await this.repo.transaction("", (c) =>
      c.query("delete from banglog_plus.analysis_leases where id=$1", [id]),
    );
  }
  async event(
    kind: string,
    code: string | null,
    model: string | null,
    latency: number | null,
  ) {
    await this.repo.transaction("", (c) =>
      c.query(
        "insert into banglog_plus.operational_events(kind,code,model,latency_ms) values($1,$2,$3,$4)",
        [kind, code, model, latency],
      ),
    );
  }
  async member(id: string, email?: string, provider?: string) {
    return this.repo.transaction("", async (c) => {
      await c.query("select set_config('banglog.user_id',$1,true)", [id]);
      const q = await c.query(
        "insert into banglog_plus.members(user_id,email,provider) values($1,$2,$3) on conflict(user_id) do update set last_seen_at=now(),email=coalesce(excluded.email,members.email),provider=coalesce(excluded.provider,members.provider) returning status",
        [id, email ?? null, provider ?? null],
      );
      if (q.rows[0].status === "blocked")
        throw new AppError("MEMBER_BLOCKED", 403);
    });
  }
  async cleanup() {
    await this.repo.cleanup();
    await this.repo.transaction("", async (c) => {
      await c.query(
        "delete from banglog_plus.rate_limits where expires_at<=now()",
      );
      await c.query(
        "delete from banglog_plus.analysis_leases where expires_at<=now()",
      );
      await c.query(
        "delete from banglog_plus.operational_events where created_at<now()-interval '30 days'",
      );
    });
  }
}
