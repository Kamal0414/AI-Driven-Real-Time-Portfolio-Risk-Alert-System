import type { EventBridgeEvent } from 'aws-lambda';
import {
  createLogger,
  publishEvent,
  buildBreachKey,
  EVENT_SOURCE,
  EVENT_TYPE,
} from '@prr/shared';
import type {
  PriceUpdatedData,
  RiskThresholdBreachedData,
  Portfolio,
  Price,
  Alert,
} from '@prr/shared';
import { buildPriceMap, computeValuation } from '../domain/valuation.engine.js';
import { evaluateRules, getOverallSeverity } from '../domain/rules/index.js';
import * as portfolioRepo from '../repo/portfolio.read-repo.js';
import * as valuationRepo from '../repo/valuation.repo.js';
import * as alertRepo from '../repo/alert.repo.js';

const log = createLogger({ service: 'risk-service' });

/**
 * onPriceUpdated — triggered by EventBridge when PriceUpdated fires.
 *
 * Flow:
 * 1. Extract prices from event (or load from DB as fallback).
 * 2. Load all 100 portfolios.
 * 3. For each portfolio:
 *    a. Compute valuation.
 *    b. Run rules engine.
 *    c. If breaches found → persist alert (idempotent) + publish event.
 * 4. Persist latest valuation for dashboard queries.
 *
 * Performance:
 * - 100 portfolios × 20 symbols = 2000 lines → trivial in-memory work.
 * - Parallelized DynamoDB writes.
 * - Typically completes in <2s.
 */
export const handler = async (
  event: EventBridgeEvent<'PriceUpdated', PriceUpdatedData>,
): Promise<void> => {
  const startMs = Date.now();
  const correlationId = (event.detail as unknown as { correlationId?: string }).correlationId ?? event.id;

  try {
    // 1. Get prices from event payload
    const eventDetail = event.detail as unknown as { data?: PriceUpdatedData } & PriceUpdatedData;
    const priceData = eventDetail.data ?? eventDetail;
    let prices: Price[];

    if (priceData.prices && priceData.prices.length > 0) {
      prices = priceData.prices;
    } else {
      // Fallback: load from DB (shouldn't happen in normal flow)
      const { loadAllPrices } = await import('../repo/price.read-repo.js');
      prices = await loadAllPrices();
    }

    const priceMap = buildPriceMap(prices);
    log.info('prices loaded', { count: prices.length, correlationId });

    // 2. Load all portfolios
    const portfolios = await portfolioRepo.loadAllPortfolios();
    log.info('portfolios loaded', { count: portfolios.length });

    // 3. Process each portfolio
    let breachCount = 0;
    const writePromises: Promise<unknown>[] = [];

    for (const portfolio of portfolios) {
      const valuation = computeValuation(portfolio, priceMap);
      if (!valuation) continue;

      // Persist valuation (fire-and-forget for speed)
      writePromises.push(valuationRepo.saveValuation(valuation));

      // Run rules
      const breaches = evaluateRules(valuation);
      if (breaches.length === 0) continue;

      // Build idempotent alerts
      const newBreaches = [];
      for (const breach of breaches) {
        const breachKey = buildBreachKey({
          type: breach.type,
          symbol: breach.metrics.symbol,
          asOf: valuation.asOf,
        });

        const alert: Alert = {
          portfolioId: portfolio.portfolioId,
          breachKey,
          clientId: portfolio.clientId,
          type: breach.type,
          severity: breach.severity,
          metrics: breach.metrics,
          thresholdRule: breach.thresholdRule,
          message: breach.message,
          portfolioValue: valuation.totalValue,
          asOf: valuation.asOf,
          createdAt: valuation.asOf,
        };

        // Save alert (idempotent — returns false if duplicate)
        const isNew = await alertRepo.saveAlert(alert);
        if (isNew) {
          newBreaches.push(breach);
        }
      }

      // Only publish event if there are genuinely new breaches
      if (newBreaches.length > 0) {
        breachCount += newBreaches.length;

        const riskData: RiskThresholdBreachedData = {
          portfolioId: portfolio.portfolioId,
          clientId: portfolio.clientId,
          breaches: newBreaches,
          overallSeverity: getOverallSeverity(newBreaches),
          portfolioValue: valuation.totalValue,
          asOf: valuation.asOf,
        };

        writePromises.push(
          publishEvent({
            eventType: EVENT_TYPE.RISK_THRESHOLD_BREACHED,
            source: EVENT_SOURCE.RISK,
            data: riskData,
            correlationId,
          }),
        );
      }
    }

    // Wait for all async writes to complete
    await Promise.all(writePromises);

    const durationMs = Date.now() - startMs;
    log.info('price update processing complete', {
      portfoliosProcessed: portfolios.length,
      breachesDetected: breachCount,
      durationMs,
      correlationId,
    });
  } catch (err) {
    log.error('onPriceUpdated handler failed', { err, correlationId });
    throw err;
  }
};
