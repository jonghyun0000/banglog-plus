import { z } from "zod";
export const lotSchema = z
  .object({
    code: z.string().regex(/^\d{10}$/),
    bun: z.string().regex(/^\d{1,4}$/),
    ji: z.string().regex(/^\d{1,4}$/),
    mountain: z.boolean(),
    page: z.number().int().min(1).max(100).default(1),
  })
  .strict();
export async function lookupBuilding(key: string, raw: unknown) {
  const p = lotSchema.parse(raw);
  const params = new URLSearchParams({
    serviceKey: key.includes("%") ? decodeURIComponent(key) : key,
    sigunguCd: p.code.slice(0, 5),
    bjdongCd: p.code.slice(5),
    platGbCd: p.mountain ? "1" : "0",
    bun: p.bun.padStart(4, "0"),
    ji: p.ji.padStart(4, "0"),
    pageNo: String(p.page),
    numOfRows: "20",
    _type: "json",
  });
  const res = await fetch(
    `https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?${params}`,
    { signal: AbortSignal.timeout(9000) },
  );
  if (!res.ok) throw new Error("building unavailable");
  const rawData = await res.json();
  const data = z
    .object({
      response: z.object({
        header: z.object({ resultCode: z.string() }),
        body: z
          .object({
            totalCount: z.coerce.number(),
            items: z.union([
              z.string(),
              z.object({
                item: z.union([
                  z.record(z.string(), z.unknown()),
                  z.array(z.record(z.string(), z.unknown())),
                ]),
              }),
            ]),
          })
          .optional(),
      }),
    })
    .parse(rawData).response;
  if (data.header.resultCode !== "00" || !data.body)
    throw new Error("building unavailable");
  const list = typeof data.body.items === "string" ? [] : data.body.items.item;
  const rows = Array.isArray(list) ? list : [list];
  const text = (v: unknown) =>
    String(v ?? "")
      .trim()
      .slice(0, 80);
  return {
    total: data.body.totalCount,
    page: p.page,
    items: rows.map((x, i) => ({
      id: `${p.page}-${i}`,
      label:
        [text(x.bldNm), text(x.dongNm)].filter(Boolean).join(" ") ||
        "건물명 미등록",
      use: text(x.mainPurpsCdNm),
      structure: text(x.strctCdNm),
      approval: /^\d{8}$/.test(text(x.useAprDay)) ? text(x.useAprDay) : "",
      floors: Math.max(0, Math.min(200, Number(x.grndFlrCnt) || 0)),
      checkedAt: new Date().toISOString(),
      repairHistory: "unknown" as const,
      manager: "unknown" as const,
    })),
  };
}
