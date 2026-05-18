import { z } from 'zod';
import { EVENT_SOURCE, EVENT_TYPE, SCHEMA_VERSION } from '../constants.js';

export const EventSourceSchema = z.enum([
  EVENT_SOURCE.PORTFOLIO,
  EVENT_SOURCE.MARKET_DATA,
  EVENT_SOURCE.RISK,
  EVENT_SOURCE.AI_INSIGHT,
]);

export const EventTypeSchema = z.enum([
  EVENT_TYPE.PRICE_UPDATED,
  EVENT_TYPE.PORTFOLIO_UPDATED,
  EVENT_TYPE.PORTFOLIO_REVALUED,
  EVENT_TYPE.RISK_THRESHOLD_BREACHED,
  EVENT_TYPE.AI_INSIGHT_GENERATED,
]);

/**
 * The common envelope wrapping every domain event published to EventBridge.
 * The envelope is what we put in the EventBridge `Detail` field; EventBridge's
 * `Source` and `DetailType` mirror `sourceService` and `eventType`.
 */
export const eventEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    eventId: z.string().uuid(),
    eventType: EventTypeSchema,
    occurredAt: z.string().datetime(),
    correlationId: z.string().min(1),
    sourceService: EventSourceSchema,
    data: dataSchema,
  });

/** Generic envelope type, parameterised by the event-specific data shape. */
export type EventEnvelope<TData> = {
  schemaVersion: typeof SCHEMA_VERSION;
  eventId: string;
  eventType: z.infer<typeof EventTypeSchema>;
  occurredAt: string;
  correlationId: string;
  sourceService: z.infer<typeof EventSourceSchema>;
  data: TData;
};
