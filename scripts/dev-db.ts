import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { spawn } from "node:child_process";
const local = parse(await readFile(".local/database.env"));
const child = spawn("npm", ["run", "dev"], {
  env: { ...process.env, ...local },
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
