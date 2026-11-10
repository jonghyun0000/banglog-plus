import { z } from "zod";
import { intakeSchema, analysisSchema } from "./schema.js";
export const historyConsentVersion = "2026-11-03.history-v1";
export const historySchema = z.object({
  id: z.string().uuid(),
  input: intakeSchema,
  result: analysisSchema.extend({
    savedMessage: z.string().max(2000).optional(),
  }),
  createdAt: z.string(),
  expiresAt: z.string(),
});
export type HistoryEntry = z.infer<typeof historySchema>;
