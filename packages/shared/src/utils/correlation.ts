import { v4 as uuid } from 'uuid';

/** Generate a fresh correlation id when an event has no upstream id. */
export const newCorrelationId = (): string => uuid();

/** Generate a fresh event id (envelope.eventId). */
export const newEventId = (): string => uuid();

/**
 * Build a deterministic idempotency key for risk alerts.
 *
 * Same portfolio + same breach type + same symbol + same minute
 * collapses into one logical alert, so a stream of price ticks during a
 * volatile minute won't spam the AI service.
 */
export const buildBreachKey = (input: {
  type: string;
  symbol?: string;
  asOf: string;
}): string => {
  const minuteBucket = input.asOf.slice(0, 16); // YYYY-MM-DDTHH:MM
  const sym = input.symbol ?? 'PORTFOLIO';
  return `${input.type}#${sym}#${minuteBucket}`;
};
