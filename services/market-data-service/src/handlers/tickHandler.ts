import {
  createLogger,
  publishEvent,
  EVENT_SOURCE,
  EVENT_TYPE,
} from '@prr/shared';
import type { PriceUpdatedData } from '@prr/shared';
import { simulateTick } from '../domain/priceSimulator.js';
import * as priceRepo from '../repo/price.repo.js';

const log = createLogger({ service: 'market-data-service' });

/**
 * tickHandler — invoked every 7 seconds by EventBridge Scheduler.
 *
 * Flow:
 * 1. Load current prices from DynamoDB (or seed on first run).
 * 2. Simulate one tick of price movement (bounded random walk).
 * 3. Persist new prices to DynamoDB.
 * 4. Publish PriceUpdated event to EventBridge.
 *
 * Design notes:
 * - Idempotent: re-running produces a new valid tick (no harm from retries).
 * - Fast: single Scan (20 items) + single BatchWrite + single PutEvents call.
 * - Failure: if EventBridge publish fails, prices are still persisted —
 *   next tick will produce a fresh event anyway.
 */
export const handler = async (): Promise<void> => {
  const startMs = Date.now();

  try {
    // 1. Load previous prices
    const previousPrices = await priceRepo.loadAllPrices();
    log.info('loaded previous prices', {
      count: previousPrices?.length ?? 0,
      firstRun: !previousPrices,
    });

    // 2. Simulate new prices
    const newPrices = simulateTick(previousPrices);

    // 3. Persist to DynamoDB
    await priceRepo.saveAllPrices(newPrices);

    // 4. Publish PriceUpdated event
    const data: PriceUpdatedData = { prices: newPrices };
    const envelope = await publishEvent({
      eventType: EVENT_TYPE.PRICE_UPDATED,
      source: EVENT_SOURCE.MARKET_DATA,
      data,
    });

    const durationMs = Date.now() - startMs;
    log.info('tick completed', {
      eventId: envelope.eventId,
      correlationId: envelope.correlationId,
      priceCount: newPrices.length,
      durationMs,
      samplePrice: { symbol: newPrices[0]!.symbol, price: newPrices[0]!.price },
    });
  } catch (err) {
    log.error('tick handler failed', { err });
    throw err; // Let Lambda runtime handle retry/DLQ
  }
};
