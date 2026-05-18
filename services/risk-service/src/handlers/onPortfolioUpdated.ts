import type { EventBridgeEvent } from 'aws-lambda';
import {
  createLogger,
  publishEvent,
  buildBreachKey,
  EVENT_SOURCE,
  EVENT_TYPE,
} from '@prr/shared';
import type {
  PortfolioUpdatedData,
  RiskThresholdBreachedData,
  Portfolio,
  Alert,
} from '@prr/shared';
import { buildPriceMap, computeValuation } from '../domain/valuation.engine.js';
import { evaluateRules, getOverallSeverity } from '../domain/rules/index.js';
import * as priceRepo from '../repo/price.read-repo.js';
import * as valuationRepo from '../repo/valuation.repo.js';
import * as alertRepo from '../repo/alert.repo.js';

const log = createLogger({ service: 'risk-service' });

/**
 * onPortfolioUpdated — triggered when a portfolio is created or updated.
 *
 * Immediately revalues the single portfolio against latest prices and
 * runs the rules engine. This ensures that a newly created portfolio
 * or one with changed holdings gets an instant risk assessment rather
 * than waiting for the next price tick.
 */
export const handler = async (
  event: EventBridgeEvent<'PortfolioUpdated', PortfolioUpdatedData>,
): Promise<void> => {
  const correlationId = (event.detail as unknown as { correlationId?: string }).correlationId ?? event.id;

  try {
    // Extract portfolio data from event
    const eventDetail = event.detail as unknown as { data?: PortfolioUpdatedData } & PortfolioUpdatedData;
    const data = eventDetail.data ?? eventDetail;

    log.info('portfolio update received', {
      portfolioId: data.portfolioId,
      changeType: data.changeType,
      correlationId,
    });

    // Skip deleted portfolios
    if (data.changeType === 'DELETED') {
      log.info('portfolio deleted, skipping revaluation', { portfolioId: data.portfolioId });
      return;
    }

    // Load latest prices
    const prices = await priceRepo.loadAllPrices();
    if (prices.length === 0) {
      log.warn('no prices available, skipping revaluation', { portfolioId: data.portfolioId });
      return;
    }
    const priceMap = buildPriceMap(prices);

    // Build a portfolio-like object from the event data
    const portfolio: Portfolio = {
      portfolioId: data.portfolioId,
      clientId: data.clientId,
      name: '', // Not needed for valuation
      cash: data.cash,
      holdings: data.holdings,
      targetAllocation: data.targetAllocation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Compute valuation
    const valuation = computeValuation(portfolio, priceMap);
    if (!valuation) {
      log.warn('could not compute valuation', { portfolioId: data.portfolioId });
      return;
    }

    // Persist valuation
    await valuationRepo.saveValuation(valuation);

    // Run rules
    const breaches = evaluateRules(valuation);
    if (breaches.length === 0) {
      log.info('no breaches detected for updated portfolio', {
        portfolioId: data.portfolioId,
        totalValue: valuation.totalValue,
      });
      return;
    }

    // Save alerts (idempotent)
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

      const isNew = await alertRepo.saveAlert(alert);
      if (isNew) newBreaches.push(breach);
    }

    // Publish event if new breaches
    if (newBreaches.length > 0) {
      const riskData: RiskThresholdBreachedData = {
        portfolioId: portfolio.portfolioId,
        clientId: portfolio.clientId,
        breaches: newBreaches,
        overallSeverity: getOverallSeverity(newBreaches),
        portfolioValue: valuation.totalValue,
        asOf: valuation.asOf,
      };

      await publishEvent({
        eventType: EVENT_TYPE.RISK_THRESHOLD_BREACHED,
        source: EVENT_SOURCE.RISK,
        data: riskData,
        correlationId,
      });

      log.info('risk breach published for updated portfolio', {
        portfolioId: data.portfolioId,
        breachCount: newBreaches.length,
        overallSeverity: riskData.overallSeverity,
      });
    }
  } catch (err) {
    log.error('onPortfolioUpdated handler failed', { err, correlationId });
    throw err;
  }
};
