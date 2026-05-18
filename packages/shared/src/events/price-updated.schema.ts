import { z } from 'zod';
import { eventEnvelopeSchema } from './envelope.js';
import { PriceSchema } from '../domain/price.js';
import { EVENT_TYPE } from '../constants.js';

export const PriceUpdatedDataSchema = z.object({
  /** Batch of latest prices in this tick. */
  prices: z.array(PriceSchema).min(1),
});
export type PriceUpdatedData = z.infer<typeof PriceUpdatedDataSchema>;

export const PriceUpdatedEventSchema = eventEnvelopeSchema(PriceUpdatedDataSchema).extend({
  eventType: z.literal(EVENT_TYPE.PRICE_UPDATED),
});
export type PriceUpdatedEvent = z.infer<typeof PriceUpdatedEventSchema>;
