import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { spawn } from "node:child_process";
const database = parse(await readFile(".local/database.env"));
const ai = parse(await readFile(".local/ai.env"));
if (!ai.OPENAI_API_KEY?.startsWith("sk-") || !ai.OPENAI_MODEL?.trim()) {
  console.error(
    "AI_SETTINGS_REQUIRED: set OPENAI_API_KEY and OPENAI_MODEL in .local/ai.env. Values are never printed.",
  );
  process.exit(1);
}
const child = spawn("npm", ["run", "dev"], {
  env: {
    ...process.env,
    ...database,
    ...ai,
    AI_MODE: "live",
    REPOSITORY: "database",
    INTERNAL_LIVE_ENABLED: "true",
    PROVIDER_RETENTION_ACK: "true",
    AI_FALLBACK_ENABLED: "true",
  },
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
