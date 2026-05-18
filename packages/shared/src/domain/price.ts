import { z } from 'zod';

/** Latest price snapshot for a single symbol. */
export const PriceSchema = z.object({
  symbol: z.string().min(1).max(10),
  price: z.number().positive(),
  /** Reference price used to compute daily change (last close or session open). */
  previousClose: z.number().positive(),
  asOf: z.string().datetime(),
});
export type Price = z.infer<typeof PriceSchema>;

export const PriceMapSchema = z.record(z.string(), PriceSchema);
/** symbol -> Price lookup, used inside the Risk valuation engine. */
export type PriceMap = z.infer<typeof PriceMapSchema>;
