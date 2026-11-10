import { defaultIntake, consentVersion } from "../shared/schema.js";
import { writeFileSync } from "node:fs";
const base = "https://banglog-plus.vercel.app";
const status = await fetch(base + "/api/status").then((r) => r.json());
if (status.version !== "1.3.0") throw Error("version not live");
const html = await fetch(base).then((r) => r.text());
const paths = [
  ...html.matchAll(/(?:href|src)="([^"]+(?:png|ico|webmanifest))"/g),
].map((m) => m[1]);
const assets = [];
for (const path of paths) {
  const r = await fetch(new URL(path, base));
  if (!r.ok) throw Error("asset failed");
  assets.push({ path, status: r.status });
}
const session = await fetch(base + "/api/sessions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ noticeAccepted: true, consentVersion }),
}).then((r) => r.json());
if (!session.token) throw Error("session failed");
const headers = {
  "content-type": "application/json",
  authorization: `Bearer ${session.token}`,
};
let analysis;
try {
  const r = await fetch(base + "/api/analyses", {
    method: "POST",
    headers,
    body: JSON.stringify({
      intake: {
        ...defaultIntake,
        issue: "drain",
        observation: "slow-drain",
        safety: "none",
        preexisting: "no",
        drain: {
          location: "basin",
          scope: "single",
          overflow: "no",
          chemical: "no",
          attempted: "none",
        },
      },
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  analysis = await r.json();
  if (
    !r.ok ||
    !analysis.fallback ||
    analysis.sources?.length ||
    analysis.costResponsibility?.direction !== "undetermined"
  )
    throw Error("fallback verification failed");
} finally {
  await fetch(base + "/api/session", { method: "DELETE", headers });
}
const result = {
  version: status.version,
  api: status.api,
  database: status.database,
  assets,
  fallback: analysis.fallback.reason,
  drainRoute: analysis.drainGuide?.route,
  testSessionDeleted: true,
};
writeFileSync(
  "docs/pilot/v13-production-verification.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
