import { appendFile } from "node:fs/promises";
import { sources } from "../server/sources/catalog.js";
const quote = (value: string | null) =>
  value === null ? "null" : `'${value.replaceAll("'", "''")}'`;
let sql = "\nbegin;\n";
for (const s of sources) {
  sql += `insert into banglog_plus.legal_sources values (${[s.id, s.title, s.institution, s.url].map(quote).join(",")});\n`;
  sql += `insert into banglog_plus.legal_source_versions values (${[s.id, s.version, s.location, s.checkedAt, s.effectiveDate, s.technicalStatus, s.humanLegalReview, s.use, JSON.stringify(s)].map(quote).join(",")});\n`;
}
sql += "commit;\n";
await appendFile(
  "supabase/migrations/20261015115914_initial_banglog_plus.sql",
  sql,
);
