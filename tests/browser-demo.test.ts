import { describe, expect, it } from "vitest";
import { createBrowserDemo } from "../src/app/browser-demo";
import { defaultIntake } from "../shared/schema";

describe("hosted browser demo", () => {
  it("requires consent session, masks input and reuses a matching request", async () => {
    const api = createBrowserDemo();
    const signal = new AbortController().signal;
    const input = { ...defaultIntake, description: "연락처 010-1234-5678" };
    await expect(api.analyze(input, "a", signal)).rejects.toThrow();
    await api.session();
    const result = await api.analyze(input, "a", signal);
    expect(JSON.stringify(result)).not.toContain("010-1234-5678");
    expect(result.mode).toBe("mock");
    expect(await api.analyze(input, "a", signal)).toEqual(result);
    await expect(
      api.analyze({ ...input, description: "다른 입력" }, "a", signal),
    ).rejects.toThrow();
  });
  it("does not share results across pages or retain results after deletion", async () => {
    const api = createBrowserDemo(),
      other = createBrowserDemo();
    await api.session();
    await other.session();
    const result = await api.analyze(
      defaultIntake,
      "a",
      new AbortController().signal,
    );
    await expect(other.copied(result.analysisId)).rejects.toThrow();
    await api.remove();
    expect(api.hasSession()).toBe(false);
    await api.session();
    await expect(api.copied(result.analysisId)).rejects.toThrow();
  });
  it("honors abort and cancel and validates feedback", async () => {
    const api = createBrowserDemo();
    await api.session();
    await expect(
      api.analyze(defaultIntake, "a", AbortSignal.abort()),
    ).rejects.toThrow();
    const result = await api.analyze(
      defaultIntake,
      "b",
      new AbortController().signal,
    );
    await api.feedback(result.analysisId, {
      helpful: "yes",
      understood: "yes",
      errorType: "none",
    });
    await api.cancel("b");
    await expect(api.copied(result.analysisId)).rejects.toThrow();
    expect(await api.config()).toMatchObject({
      ai: "mock",
      storage: "browser",
      ready: true,
      publicLaunch: false,
    });
  });
});
