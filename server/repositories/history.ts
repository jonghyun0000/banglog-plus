import { randomUUID } from "node:crypto";
import type { PostgresRepository } from "./postgres.js";
import type { AnalysisRecord } from "./types.js";
import { historySchema, type HistoryEntry } from "../../shared/account.js";
import { AppError } from "../domain/errors.js";
export interface HistoryStore {
  save(
    userId: string,
    record: AnalysisRecord,
    editedMessage?: string,
  ): Promise<void>;
  list(userId: string): Promise<HistoryEntry[]>;
  remove(userId: string, id: string): Promise<void>;
}
export class PostgresHistory implements HistoryStore {
  constructor(private repo: PostgresRepository) {}
  private run<T>(
    userId: string,
    work: (c: import("pg").PoolClient) => Promise<T>,
  ) {
    return this.repo.transaction("", async (c) => {
      await c.query("select set_config('banglog.user_id',$1,true)", [userId]);
      return work(c);
    });
  }
  async save(userId: string, record: AnalysisRecord, editedMessage?: string) {
    if (record.state !== "complete" || !record.result)
      throw new AppError("NOT_FOUND", 404);
    await this.run(userId, async (c) => {
      await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
        userId,
      ]);
      await c.query(
        "delete from banglog_plus.member_history where user_id=$1 and expires_at<=now()",
        [userId],
      );
      const existing = await c.query(
        "select id from banglog_plus.member_history where user_id=$1 and analysis_id=$2",
        [userId, record.id],
      );
      if (existing.rowCount) return;
      const count = await c.query(
        "select count(*)::int as n from banglog_plus.member_history where user_id=$1",
        [userId],
      );
      if (count.rows[0].n >= 100) throw new AppError("HISTORY_LIMIT", 409);
      await c.query(
        "insert into banglog_plus.member_history(id,user_id,analysis_id,input,result) values($1,$2,$3,$4,$5) on conflict(user_id,analysis_id) do nothing",
        [
          randomUUID(),
          userId,
          record.id,
          record.input,
          {
            ...record.result,
            ...(editedMessage !== undefined
              ? { savedMessage: editedMessage }
              : {}),
          },
        ],
      );
    });
  }
  async list(userId: string) {
    return this.run(userId, async (c) => {
      const q = await c.query(
        "select id,input,result,created_at,expires_at from banglog_plus.member_history where user_id=$1 and expires_at>now() order by created_at desc limit 100",
        [userId],
      );
      return q.rows.map((r) =>
        historySchema.parse({
          id: r.id,
          input: r.input,
          result: r.result,
          createdAt: r.created_at.toISOString(),
          expiresAt: r.expires_at.toISOString(),
        }),
      );
    });
  }
  async remove(userId: string, id: string) {
    await this.run(userId, async (c) => {
      await c.query(
        "delete from banglog_plus.member_history where id=$1 and user_id=$2",
        [id, userId],
      );
    });
  }
}
