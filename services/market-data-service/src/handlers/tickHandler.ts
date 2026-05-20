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
 * Multi-tick burst configuration.
 *
 * AWS EventBridge Scheduler enforces a 1-minute minimum between invocations.
 * To meet the problem statement requirement of 5-10 second price updates,
 * each Lambda invocation runs an internal loop that produces multiple ticks
 * spaced TICK_INTERVAL_MS apart. The result is a continuous stream of
 * PriceUpdated events at ~7 second intervals from the dashboard's POV.
 *
 * 8 ticks × 7s = 56 seconds total runtime, comfortably under the 90s timeout.
 */
const TICKS_PER_INVOCATION = Number(process.env['TICKS_PER_INVOCATION'] ?? 8);
const TICK_INTERVAL_MS = Number(process.env['TICK_INTERVAL_MS'] ?? 7000);

/**
 * tickHandler — invoked every minute by EventBridge Scheduler.
 *
 * Per invocation:
 * 1. Loads previous prices once.
 * 2. Loops TICKS_PER_INVOCATION times:
 *    a. Simulate one tick of price movement.
 *    b. Persist new prices to DynamoDB.
 *    c. Publish PriceUpdated event to EventBridge.
 *    d. Wait TICK_INTERVAL_MS before the next tick (skip on last).
 *
 * Each tick uses the prices it just generated as the basis for the next
 * one, so we don't re-read DynamoDB inside the loop.
 */
export const handler = async (): Promise<void> => {
  const startMs = Date.now();
  let priceState = await priceRepo.loadAllPrices();
  log.info('starting multi-tick burst', {
    ticksPerInvocation: TICKS_PER_INVOCATION,
    tickIntervalMs: TICK_INTERVAL_MS,
    initialPriceCount: priceState?.length ?? 0,
    firstRun: !priceState,
  });

  for (let i = 0; i < TICKS_PER_INVOCATION; i++) {
    const tickStart = Date.now();

    try {
      // Simulate next tick using the in-memory state we just produced
      const newPrices = simulateTick(priceState);

      // Persist to DynamoDB
      await priceRepo.saveAllPrices(newPrices);

      // Publish PriceUpdated event
      const data: PriceUpdatedData = { prices: newPrices };
      const envelope = await publishEvent({
        eventType: EVENT_TYPE.PRICE_UPDATED,
        source: EVENT_SOURCE.MARKET_DATA,
        data,
      });

      log.info('tick published', {
        tickNumber: i + 1,
        totalTicks: TICKS_PER_INVOCATION,
        eventId: envelope.eventId,
        correlationId: envelope.correlationId,
        priceCount: newPrices.length,
        durationMs: Date.now() - tickStart,
      });

      // Update in-memory state so the next tick continues from here
      priceState = newPrices.map((p) => ({
        symbol: p.symbol,
        price: p.price,
        previousClose: p.previousClose,
        lastCloseDate: p.asOf.slice(0, 10),
      }));

      // Wait before next tick (except after the last one)
      if (i < TICKS_PER_INVOCATION - 1) {
        await sleep(TICK_INTERVAL_MS);
      }
    } catch (err) {
      // One tick failed — log and continue with the burst rather than abort.
      // The next scheduled invocation will reload from DynamoDB anyway.
      log.error('tick failed inside burst', { err, tickNumber: i + 1 });
    }
  }

  log.info('burst completed', {
    totalDurationMs: Date.now() - startMs,
    ticksPerInvocation: TICKS_PER_INVOCATION,
  });
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
