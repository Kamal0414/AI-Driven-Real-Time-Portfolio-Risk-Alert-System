import { z } from 'zod';
import { SeveritySchema } from './alert.js';

/**
 * Structured AI output. The LLM MUST return JSON matching this shape; the
 * AI Insight Service validates with Zod and falls back to deterministic copy
 * if the model misbehaves.
 */
export const InsightPayloadSchema = z.object({
  headline: z.string().min(1).max(140),
  explanation: z.string().min(1).max(1200),
  suggestedAction: z.string().min(1).max(800),
  severity: SeveritySchema,
  disclaimer: z.string().min(1).max(400),
});
export type InsightPayload = z.infer<typeof InsightPayloadSchema>;

/** Persisted insight row in DynamoDB. */
export const InsightSchema = InsightPayloadSchema.extend({
  portfolioId: z.string().min(1),
  generatedAt: z.string().datetime(),
  /** Provider that produced this insight (mock/openai/gemini/bedrock). */
  generatedBy: z.string().min(1),
  modelVersion: z.string().min(1).optional(),
  /** True when the AI call failed and we used a deterministic fallback. */
  fallback: z.boolean(),
  /** Correlation back to the originating risk event. */
  correlationId: z.string().min(1),
  /** TTL epoch seconds — DynamoDB will auto-purge. */
  ttl: z.number().int().positive().optional(),
});
export type Insight = z.infer<typeof InsightSchema>;
