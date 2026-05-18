import { z } from 'zod';

/** A single holding inside a portfolio. */
export const HoldingSchema = z.object({
  symbol: z.string().min(1).max(10),
  quantity: z.number().nonnegative(),
});
export type Holding = z.infer<typeof HoldingSchema>;

/** A target allocation weight (0..1) for a symbol in the model portfolio. */
export const TargetAllocationSchema = z.object({
  symbol: z.string().min(1).max(10),
  weight: z.number().min(0).max(1),
});
export type TargetAllocation = z.infer<typeof TargetAllocationSchema>;

/** Full client portfolio aggregate. */
export const PortfolioSchema = z
  .object({
    portfolioId: z.string().min(1),
    clientId: z.string().min(1),
    name: z.string().min(1),
    /** Free cash component, USD. */
    cash: z.number().nonnegative().default(0),
    holdings: z.array(HoldingSchema).min(1),
    targetAllocation: z.array(TargetAllocationSchema).min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((p, ctx) => {
    const total = p.targetAllocation.reduce((s, a) => s + a.weight, 0);
    // Allow tiny floating-point slack.
    if (Math.abs(total - 1) > 1e-6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `targetAllocation weights must sum to 1.0 (got ${total.toFixed(6)})`,
        path: ['targetAllocation'],
      });
    }
  });
export type Portfolio = z.infer<typeof PortfolioSchema>;
