import { describe, it, expect } from 'vitest';
import { buildBreachKey, newCorrelationId, newEventId } from '../utils/correlation.js';

describe('buildBreachKey', () => {
  it('produces a stable key for the same minute + symbol + type', () => {
    const a = buildBreachKey({
      type: 'SINGLE_STOCK_EXPOSURE',
      symbol: 'AAPL',
      asOf: '2026-05-18T10:00:01.000Z',
    });
    const b = buildBreachKey({
      type: 'SINGLE_STOCK_EXPOSURE',
      symbol: 'AAPL',
      asOf: '2026-05-18T10:00:59.999Z',
    });
    expect(a).toBe(b);
    expect(a).toBe('SINGLE_STOCK_EXPOSURE#AAPL#2026-05-18T10:00');
  });

  it('changes when the minute rolls over', () => {
    const a = buildBreachKey({ type: 'X', symbol: 'AAPL', asOf: '2026-05-18T10:00:30.000Z' });
    const b = buildBreachKey({ type: 'X', symbol: 'AAPL', asOf: '2026-05-18T10:01:00.000Z' });
    expect(a).not.toBe(b);
  });

  it('uses PORTFOLIO when symbol is omitted', () => {
    const k = buildBreachKey({ type: 'DAILY_PORTFOLIO_DROP', asOf: '2026-05-18T10:00:00.000Z' });
    expect(k).toBe('DAILY_PORTFOLIO_DROP#PORTFOLIO#2026-05-18T10:00');
  });
});

describe('id generators', () => {
  it('returns distinct uuids', () => {
    expect(newCorrelationId()).not.toBe(newCorrelationId());
    expect(newEventId()).not.toBe(newEventId());
  });
});
