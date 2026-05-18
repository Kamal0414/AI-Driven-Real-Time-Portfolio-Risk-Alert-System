import { z } from 'zod';
import { eventEnvelopeSchema } from './envelope.js';
import { ValuationSchema } from '../domain/valuation.js';
import { EVENT_TYPE } from '../constants.js';

/**
 * Optional internal event published by the Risk Service after each
 * revaluation. Mostly useful for downstream analytics or a future
 * realtime dashboard channel; not strictly required for the alert flow.
 */
export const PortfolioRevaluedDataSchema = ValuationSchema.extend({
  clientId: z.string().min(1),
});
export type PortfolioRevaluedData = z.infer<typeof PortfolioRevaluedDataSchema>;

export const PortfolioRevaluedEventSchema = eventEnvelopeSchema(PortfolioRevaluedDataSchema).extend(
  { eventType: z.literal(EVENT_TYPE.PORTFOLIO_REVALUED) },
);
export type PortfolioRevaluedEvent = z.infer<typeof PortfolioRevaluedEventSchema>;
