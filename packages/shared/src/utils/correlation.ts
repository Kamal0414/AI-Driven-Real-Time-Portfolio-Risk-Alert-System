import { v4 as uuid } from 'uuid';

/** Generate a fresh correlation id when an event has no upstream id. */
export const newCorrelationId = (): string => uuid();

/** Generate a fresh event id (envelope.eventId). */
export const newEventId = (): string => uuid();

/**
 * Build a deterministic idempotency key for risk alerts.
 *
 * Same portfolio + same breach type + same symbol + same hour
 * collapses into one logical alert. This means an ongoing breach
 * (e.g. AAPL stays > 20% for 2 hours) generates exactly 2 alerts,
 * not 120. New breaches in a different hour will still alert.
 */
export const buildBreachKey = (input: {
  type: string;
  symbol?: string;
  asOf: string;
}): string => {
  const hourBucket = input.asOf.slice(0, 13); // YYYY-MM-DDTHH
  const sym = input.symbol ?? 'PORTFOLIO';
  return `${input.type}#${sym}#${hourBucket}`;
};
