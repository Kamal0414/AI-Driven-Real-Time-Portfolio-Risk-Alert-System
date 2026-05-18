import { z } from 'zod';
import { eventEnvelopeSchema } from './envelope.js';
import { BreachSchema, SeveritySchema } from '../domain/alert.js';
import { EVENT_TYPE } from '../constants.js';

export const RiskThresholdBreachedDataSchema = z.object({
  portfolioId: z.string().min(1),
  clientId: z.string().min(1),
  /**
   * One event can carry multiple simultaneous breaches (e.g. a sharp drop
   * may trigger both DAILY_PORTFOLIO_DROP and SINGLE_STOCK_EXPOSURE in
   * the same revaluation). The downstream AI service handles them together.
   */
  breaches: z.array(BreachSchema).min(1),
  /** Highest severity across the breaches array. */
  overallSeverity: SeveritySchema,
  portfolioValue: z.number().nonnegative(),
  asOf: z.string().datetime(),
});
export type RiskThresholdBreachedData = z.infer<typeof RiskThresholdBreachedDataSchema>;

export const RiskThresholdBreachedEventSchema = eventEnvelopeSchema(
  RiskThresholdBreachedDataSchema,
).extend({ eventType: z.literal(EVENT_TYPE.RISK_THRESHOLD_BREACHED) });
export type RiskThresholdBreachedEvent = z.infer<typeof RiskThresholdBreachedEventSchema>;
