import { z } from 'zod';

/** Per-symbol contribution inside a portfolio valuation. */
export const AllocationLineSchema = z.object({
  symbol: z.string().min(1).max(10),
  quantity: z.number().nonnegative(),
  price: z.number().nonnegative(),
  value: z.number().nonnegative(),
  /** Actual weight in the portfolio (0..1). */
  weight: z.number().min(0).max(1),
  /** Target weight (0..1) — copied through from the portfolio model. */
  targetWeight: z.number().min(0).max(1),
  /** actualWeight - targetWeight, signed. */
  drift: z.number(),
});
export type AllocationLine = z.infer<typeof AllocationLineSchema>;

/** Full point-in-time valuation snapshot for a portfolio. */
export const ValuationSchema = z.object({
  portfolioId: z.string().min(1),
  totalValue: z.number().nonnegative(),
  cash: z.number().nonnegative(),
  asOf: z.string().datetime(),
  allocations: z.array(AllocationLineSchema),
  /** Daily change ratio, e.g. -0.025 = -2.5%. */
  dayChangePct: z.number(),
  /** Reference value used for the daily change calculation. */
  previousCloseValue: z.number().nonnegative(),
});
export type Valuation = z.infer<typeof ValuationSchema>;
