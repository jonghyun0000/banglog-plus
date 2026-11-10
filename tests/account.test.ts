import { it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { supabaseVerifier } from "../server/auth/member.js";
import { loadConfig } from "../server/config.js";
import { createApp } from "../server/routes/app.js";
import { MemoryRepository } from "../server/repositories/memory.js";
import { consentVersion, defaultIntake } from "../shared/schema.js";
import { historyConsentVersion } from "../shared/account.js";
import { AppError } from "../server/domain/errors.js";
const config = loadConfig({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  MEMBER_HISTORY_ENABLED: "true",
  REPOSITORY: "database",
  DATABASE_URL: "postgres://localhost/test",
});
it("auth verifies the user on Supabase and rejects anonymous, invalid and unavailable identities", async () => {
  const id = randomUUID();
  for (const [body, status, ok] of [
    [{ id }, 200, true],
    [{ id, is_anonymous: true }, 200, false],
    [{ id, app_metadata: { provider: "email" } }, 200, false],
    [
      {
        id,
        app_metadata: { provider: "email" },
        email_confirmed_at: new Date().toISOString(),
      },
      200,
      true,
    ],
    [{}, 401, false],
    [{}, 503, false],
  ] as const) {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body), { status }));
    const verify = supabaseVerifier(config, fetcher);
    if (ok) expect(await verify("test-jwt")).toBe(id);
    else await expect(verify("test-jwt")).rejects.toBeInstanceOf(AppError);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://example.supabase.co/auth/v1/user",
    );
  }
});
it("account APIs require member authentication, valid guest ownership and explicit history consent", async () => {
  const user = randomUUID();
  const history = {
    save: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    remove: vi.fn(),
  };
  const repo = new MemoryRepository();
  const { app } = createApp({
    config,
    repository: repo,
    history,
    verifyMember: async (token) => {
      if (token !== "member-token")
        throw new AppError("MEMBER_UNAUTHORIZED", 401);
      return user;
    },
  });
  try {
    expect(
      (await app.inject({ method: "GET", url: "/api/account/history" }))
        .statusCode,
    ).toBe(401);
    const memberHeaders = { authorization: "Bearer member-token" };
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/account/history",
          headers: memberHeaders,
        })
      ).statusCode,
    ).toBe(200);
    expect(history.list).toHaveBeenCalledWith(user);
    const session = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { noticeAccepted: true, consentVersion },
    });
    const guest = session.json().token;
    const result = await app.inject({
      method: "POST",
      url: "/api/analyses",
      headers: { authorization: `Bearer ${guest}` },
      payload: { intake: defaultIntake, idempotencyKey: randomUUID() },
    });
    const analysisId = result.json().analysisId;
    expect(result.statusCode).toBe(200);
    const save = (
      headers: Record<string, string>,
      payload: Record<string, unknown>,
    ) =>
      app.inject({
        method: "POST",
        url: "/api/account/history",
        headers,
        payload,
      });
    const body = { analysisId, consentVersion: historyConsentVersion };
    expect((await save(memberHeaders, body)).statusCode).toBe(401);
    expect(
      (await save({ ...memberHeaders, "x-guest-token": guest }, { analysisId }))
        .statusCode,
    ).toBe(400);
    const other = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { noticeAccepted: true, consentVersion },
    });
    expect(
      (
        await save(
          { ...memberHeaders, "x-guest-token": other.json().token },
          body,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (await save({ ...memberHeaders, "x-guest-token": guest }, body))
        .statusCode,
    ).toBe(204);
    expect(
      (
        await save(
          { ...memberHeaders, "x-guest-token": guest },
          { ...body, editedMessage: "연락처 010-1234-5678로 연락" },
        )
      ).statusCode,
    ).toBe(204);
    expect(history.save.mock.calls.at(-1)?.[2]).not.toContain("010-1234-5678");
    expect(
      (
        await save(
          { ...memberHeaders, "x-guest-token": guest },
          { ...body, editedMessage: "가".repeat(2001) },
        )
      ).statusCode,
    ).toBe(400);
    expect(history.save).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ id: analysisId }),
      undefined,
    );
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/account/history/${analysisId}`,
          headers: memberHeaders,
        })
      ).statusCode,
    ).toBe(204);
    expect(history.remove).toHaveBeenCalledWith(user, analysisId);
  } finally {
    await app.close();
  }
});
it("unconfigured account endpoint fails closed without affecting guest usage", async () => {
  const { app } = createApp({ config: loadConfig({}) });
  try {
    expect(
      (await app.inject({ method: "GET", url: "/api/account/history" }))
        .statusCode,
    ).toBe(503);
  } finally {
    await app.close();
  }
});
