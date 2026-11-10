import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server/routes/app.js";
import { PostgresRepository } from "../server/repositories/postgres.js";
const { app, repo } = createApp();
let ready: Promise<void> | undefined;
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    ready ??= (async () => {
      if (!(repo instanceof PostgresRepository))
        throw Error("DATABASE_REQUIRED");
      await repo.verifyReady();
      await app.ready();
    })();
    await ready;
    app.server.emit("request", req, res);
  } catch {
    ready = undefined;
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify({
        code: "CONFIG_NOT_READY",
        message: "서비스 연결을 확인하고 있어요. 잠시 후 다시 시도해 주세요.",
      }),
    );
  }
}
