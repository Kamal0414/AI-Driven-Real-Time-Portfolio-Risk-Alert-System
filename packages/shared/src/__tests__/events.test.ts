import { describe, it, expect } from 'vitest';
import {
  PriceUpdatedEventSchema,
  PortfolioUpdatedEventSchema,
  RiskThresholdBreachedEventSchema,
  AIInsightGeneratedEventSchema,
} from '../events/index.js';
import { EVENT_SOURCE, EVENT_TYPE, SCHEMA_VERSION } from '../constants.js';

const baseEnvelope = {
  schemaVersion: SCHEMA_VERSION,
  eventId: '11111111-1111-4111-8111-111111111111',
  occurredAt: '2026-05-18T10:00:00.000Z',
  correlationId: 'corr-123',
};

describe('PriceUpdated event schema', () => {
  it('accepts a valid batch of prices', () => {
    const result = PriceUpdatedEventSchema.safeParse({
      ...baseEnvelope,
      eventType: EVENT_TYPE.PRICE_UPDATED,
      sourceService: EVENT_SOURCE.MARKET_DATA,
      data: {
        prices: [
          { symbol: 'AAPL', price: 187.42, previousClose: 185.1, asOf: '2026-05-18T10:00:00.000Z' },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative prices', () => {
    const result = PriceUpdatedEventSchema.safeParse({
      ...baseEnvelope,
      eventType: EVENT_TYPE.PRICE_UPDATED,
      sourceService: EVENT_SOURCE.MARKET_DATA,
      data: {
        prices: [
          { symbol: 'AAPL', price: -1, previousClose: 185.1, asOf: '2026-05-18T10:00:00.000Z' },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched eventType', () => {
    const result = PriceUpdatedEventSchema.safeParse({
      ...baseEnvelope,
      eventType: EVENT_TYPE.PORTFOLIO_UPDATED,
      sourceService: EVENT_SOURCE.MARKET_DATA,
      data: { prices: [] },
    });
    expect(result.success).toBe(false);
  });
});

describe('PortfolioUpdated event schema', () => {
  it('accepts a valid CREATED event', () => {
    const result = PortfolioUpdatedEventSchema.safeParse({
      ...baseEnvelope,
      eventType: EVENT_TYPE.PORTFOLIO_UPDATED,
      sourceService: EVENT_SOURCE.PORTFOLIO,
      data: {
        portfolioId: 'p-0001',
        clientId: 'c-0001',
        changeType: 'CREATED',
        cash: 1000,
        holdings: [{ symbol: 'AAPL', quantity: 50 }],
        targetAllocation: [{ symbol: 'AAPL', weight: 1 }],
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('RiskThresholdBreached event schema', () => {
  it('accepts a SINGLE_STOCK_EXPOSURE breach', () => {
    const result = RiskThresholdBreachedEventSchema.safeParse({
      ...baseEnvelope,
      eventType: EVENT_TYPE.RISK_THRESHOLD_BREACHED,
      sourceService: EVENT_SOURCE.RISK,
      data: {
        portfolioId: 'p-0001',
        clientId: 'c-0001',
        overallSeverity: 'MEDIUM',
        portfolioValue: 152340.55,
        asOf: '2026-05-18T10:00:00.000Z',
        breaches: [
          {
            type: 'SINGLE_STOCK_EXPOSURE',
            severity: 'MEDIUM',
            thresholdRule: 'single_stock>20%',
            message: 'AAPL is 23.5% of portfolio',
            metrics: { symbol: 'AAPL', actualValue: 0.235, targetValue: 0.2, deviation: 0.035 },
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty breaches array', () => {
    const result = RiskThresholdBreachedEventSchema.safeParse({
      ...baseEnvelope,
      eventType: EVENT_TYPE.RISK_THRESHOLD_BREACHED,
      sourceService: EVENT_SOURCE.RISK,
      data: {
        portfolioId: 'p-0001',
        clientId: 'c-0001',
        overallSeverity: 'LOW',
        portfolioValue: 100,
        asOf: '2026-05-18T10:00:00.000Z',
        breaches: [],
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('AIInsightGenerated event schema', () => {
  it('accepts a valid insight payload', () => {
    const result = AIInsightGeneratedEventSchema.safeParse({
      ...baseEnvelope,
      eventType: EVENT_TYPE.AI_INSIGHT_GENERATED,
      sourceService: EVENT_SOURCE.AI_INSIGHT,
      data: {
        portfolioId: 'p-0001',
        generatedAt: '2026-05-18T10:00:01.000Z',
        generatedBy: 'mock',
        fallback: false,
        severity: 'MEDIUM',
        headline: 'Concentration risk in AAPL',
        explanation: 'AAPL exceeds the 20% concentration threshold.',
        suggestedAction: 'Consider trimming AAPL exposure.',
        disclaimer: 'Informational only, not financial advice.',
      },
    });
    expect(result.success).toBe(true);
  });
});
