import { z } from 'zod';
import { BREACH_TYPE, SEVERITY } from '../constants.js';

export const SeveritySchema = z.enum([SEVERITY.LOW, SEVERITY.MEDIUM, SEVERITY.HIGH]);
export const BreachTypeSchema = z.enum([
  BREACH_TYPE.ALLOCATION_DRIFT,
  BREACH_TYPE.SINGLE_STOCK_EXPOSURE,
  BREACH_TYPE.DAILY_PORTFOLIO_DROP,
]);

/** Numeric metrics describing a specific rule breach. */
export const BreachMetricsSchema = z
  .object({
    /** Symbol involved in the breach (omitted for portfolio-level rules). */
    symbol: z.string().min(1).max(10).optional(),
    /** Actual measured value (weight or pct change). */
    actualValue: z.number(),
    /** Target/threshold value for comparison. */
    targetValue: z.number(),
    /** Signed deviation = actual - target. */
    deviation: z.number(),
  })
  .strict();
export type BreachMetrics = z.infer<typeof BreachMetricsSchema>;

/** A single breach detected by the rules engine. */
export const BreachSchema = z.object({
  type: BreachTypeSchema,
  severity: SeveritySchema,
  metrics: BreachMetricsSchema,
  /** Human-readable rule descriptor, e.g. "single_stock>20%". */
  thresholdRule: z.string().min(1),
  /** Pre-AI deterministic message — used as fallback if AI fails. */
  message: z.string().min(1),
});
export type Breach = z.infer<typeof BreachSchema>;

/**
 * Persisted alert row. Composite key = portfolioId + breachKey.
 * `breachKey` is engineered for idempotency (see utils/correlation.ts).
 */
export const AlertSchema = z.object({
  portfolioId: z.string().min(1),
  breachKey: z.string().min(1),
  clientId: z.string().min(1),
  type: BreachTypeSchema,
  severity: SeveritySchema,
  metrics: BreachMetricsSchema,
  thresholdRule: z.string().min(1),
  message: z.string().min(1),
  portfolioValue: z.number().nonnegative(),
  asOf: z.string().datetime(),
  createdAt: z.string().datetime(),
  /** TTL epoch seconds — DynamoDB will auto-purge. */
  ttl: z.number().int().positive().optional(),
});
export type Alert = z.infer<typeof AlertSchema>;
