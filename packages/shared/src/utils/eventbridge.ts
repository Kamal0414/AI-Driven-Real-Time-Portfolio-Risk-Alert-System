import {
  EventBridgeClient,
  PutEventsCommand,
  type PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import { ENV, EVENT_BUS_NAME, SCHEMA_VERSION, type EventSource, type EventType } from '../constants.js';
import { newCorrelationId, newEventId } from './correlation.js';
import { logger } from './logger.js';
import type { EventEnvelope } from '../events/envelope.js';

/** Lazily-initialised singleton — re-used across warm Lambda invocations. */
let _client: EventBridgeClient | null = null;
const getClient = (): EventBridgeClient => {
  if (!_client) {
    _client = new EventBridgeClient({
      region: process.env[ENV.AWS_REGION] ?? process.env.AWS_REGION,
    });
  }
  return _client;
};

export interface PublishInput<TData> {
  eventType: EventType;
  source: EventSource;
  data: TData;
  /** Correlation id from the triggering event; generated when omitted. */
  correlationId?: string;
}

const busName = (): string => process.env[ENV.EVENT_BUS_NAME] ?? EVENT_BUS_NAME;

const buildEnvelope = <TData>(input: PublishInput<TData>): EventEnvelope<TData> => ({
  schemaVersion: SCHEMA_VERSION,
  eventId: newEventId(),
  eventType: input.eventType,
  occurredAt: new Date().toISOString(),
  correlationId: input.correlationId ?? newCorrelationId(),
  sourceService: input.source,
  data: input.data,
});

const toEntry = (env: EventEnvelope<unknown>): PutEventsRequestEntry => ({
  EventBusName: busName(),
  Source: env.sourceService,
  DetailType: env.eventType,
  Detail: JSON.stringify(env),
  Time: new Date(env.occurredAt),
});

/**
 * Publish a single domain event to the custom EventBridge bus.
 * Returns the fully-formed envelope so callers can log the eventId.
 *
 * EventBridge accepts up to 10 entries per `PutEvents` call; we split
 * batches automatically.
 */
export const publishEvent = async <TData>(
  input: PublishInput<TData>,
): Promise<EventEnvelope<TData>> => {
  const envelope = buildEnvelope(input);
  await sendEntries([toEntry(envelope)]);
  return envelope;
};

/** Publish many events efficiently in a single round-trip. */
export const publishEvents = async <TData>(
  inputs: ReadonlyArray<PublishInput<TData>>,
): Promise<ReadonlyArray<EventEnvelope<TData>>> => {
  if (inputs.length === 0) return [];
  const envelopes = inputs.map(buildEnvelope);
  await sendEntries(envelopes.map(toEntry));
  return envelopes;
};

const MAX_BATCH = 10;

const sendEntries = async (entries: PutEventsRequestEntry[]): Promise<void> => {
  const client = getClient();
  for (let i = 0; i < entries.length; i += MAX_BATCH) {
    const batch = entries.slice(i, i + MAX_BATCH);
    const result = await client.send(new PutEventsCommand({ Entries: batch }));
    const failed = result.FailedEntryCount ?? 0;
    if (failed > 0) {
      logger.error('eventbridge publish partial failure', {
        failed,
        total: batch.length,
        entries: result.Entries,
      });
      throw new Error(`EventBridge PutEvents failed for ${failed}/${batch.length} entries`);
    }
  }
};
