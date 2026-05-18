import { z } from 'zod';
import { eventEnvelopeSchema } from './envelope.js';
import { HoldingSchema, TargetAllocationSchema } from '../domain/portfolio.js';
import { EVENT_TYPE } from '../constants.js';

export const PortfolioUpdatedDataSchema = z.object({
  portfolioId: z.string().min(1),
  clientId: z.string().min(1),
  /** Lifecycle hint so consumers can react differently to creation vs update. */
  changeType: z.enum(['CREATED', 'UPDATED', 'DELETED']),
  holdings: z.array(HoldingSchema),
  targetAllocation: z.array(TargetAllocationSchema),
  cash: z.number().nonnegative(),
});
export type PortfolioUpdatedData = z.infer<typeof PortfolioUpdatedDataSchema>;

export const PortfolioUpdatedEventSchema = eventEnvelopeSchema(PortfolioUpdatedDataSchema).extend({
  eventType: z.literal(EVENT_TYPE.PORTFOLIO_UPDATED),
});
export type PortfolioUpdatedEvent = z.infer<typeof PortfolioUpdatedEventSchema>;
