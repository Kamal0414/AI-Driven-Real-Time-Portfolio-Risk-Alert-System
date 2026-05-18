import { describe, it, expect } from 'vitest';
import { PortfolioSchema } from '../domain/portfolio.js';

const basePortfolio = {
  portfolioId: 'p-0001',
  clientId: 'c-0001',
  name: 'Growth Fund',
  cash: 0,
  createdAt: '2026-05-18T10:00:00.000Z',
  updatedAt: '2026-05-18T10:00:00.000Z',
};

describe('PortfolioSchema', () => {
  it('accepts a portfolio whose target weights sum to 1', () => {
    const result = PortfolioSchema.safeParse({
      ...basePortfolio,
      holdings: [
        { symbol: 'AAPL', quantity: 50 },
        { symbol: 'MSFT', quantity: 30 },
      ],
      targetAllocation: [
        { symbol: 'AAPL', weight: 0.6 },
        { symbol: 'MSFT', weight: 0.4 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects target weights that do not sum to 1', () => {
    const result = PortfolioSchema.safeParse({
      ...basePortfolio,
      holdings: [{ symbol: 'AAPL', quantity: 50 }],
      targetAllocation: [
        { symbol: 'AAPL', weight: 0.5 },
        { symbol: 'MSFT', weight: 0.4 },
      ],
    });
    expect(result.success).toBe(false);
  });
});
