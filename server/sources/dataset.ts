import { z } from "zod";
import { issueSchema, sourceSchema } from "../../shared/schema.js";
import data from "../../data/repair-knowledge.v2.json" with { type: "json" };

// Canonical, curated paraphrases. User records are never added automatically.
const dataset = z
  .object({
    version: z.string().max(100),
    sources: z.array(sourceSchema),
    chunks: z.array(
      z.object({
        id: z.string().max(100),
        sourceId: z.string(),
        sourceVersion: z.string(),
        claimId: z.string().max(100),
        claim: z.string().min(1).max(800),
        text: z.string().min(1).max(2400),
        issues: z.array(issueSchema).min(1),
        keywords: z.array(z.string().min(1).max(100)).max(30),
        observations: z.array(z.string().max(100)).max(30),
      }),
    ),
  })
  .parse(data);
export const datasetVersion = dataset.version;
export const datasetSources = dataset.sources;
export const datasetChunks = dataset.chunks;
for (const p of datasetChunks) {
  if (
    !datasetSources.some(
      (s) => s.id === p.sourceId && s.version === p.sourceVersion,
    )
  )
    throw new Error("DATASET_SOURCE_MISSING");
}
