import type { Portfolio, Price, Valuation, AllocationLine } from '@prr/shared';

/**
 * Valuation Engine — computes portfolio value and allocation breakdown.
 *
 * Pure function: no side effects, no I/O. Takes portfolio + prices,
 * returns a complete Valuation snapshot.
 *
 * This is the hot path — called once per portfolio per tick (100× every 7s).
 * Kept deliberately simple and allocation-focused.
 */

/**
 * Build a price lookup map from an array of Price objects.
 */
export const buildPriceMap = (prices: Price[]): Map<string, Price> => {
  const map = new Map<string, Price>();
  for (const p of prices) {
    map.set(p.symbol, p);
  }
  return map;
};

/**
 * Compute a full valuation snapshot for a single portfolio.
 *
 * @param portfolio - The portfolio with holdings + target allocations
 * @param priceMap - Symbol → latest Price lookup
 * @param previousTotalValue - The portfolio value at previous close (for daily P&L).
 *                             If undefined, we compute it from previousClose prices.
 * @returns A complete Valuation object or null if no prices available
 */
export const computeValuation = (
  portfolio: Portfolio,
  priceMap: Map<string, Price>,
): Valuation | null => {
  const now = new Date().toISOString();

  // Build allocation lines
  const allocations: AllocationLine[] = [];
  let totalEquityValue = 0;

  for (const holding of portfolio.holdings) {
    const priceData = priceMap.get(holding.symbol);
    if (!priceData) {
      // Skip holdings with no price data (shouldn't happen with our 20 symbols)
      continue;
    }

    const value = holding.quantity * priceData.price;
    totalEquityValue += value;

    allocations.push({
      symbol: holding.symbol,
      quantity: holding.quantity,
      price: priceData.price,
      value,
      weight: 0, // placeholder — set after total is known
      targetWeight: 0, // placeholder — set below
      drift: 0, // placeholder
    });
  }

  if (allocations.length === 0) {
    return null;
  }

  const totalValue = totalEquityValue + portfolio.cash;

  // Build target weight lookup
  const targetWeightMap = new Map<string, number>();
  for (const ta of portfolio.targetAllocation) {
    targetWeightMap.set(ta.symbol, ta.weight);
  }

  // Compute actual weights and drift
  for (const line of allocations) {
    line.weight = totalValue > 0 ? roundTo6(line.value / totalValue) : 0;
    line.targetWeight = targetWeightMap.get(line.symbol) ?? 0;
    line.drift = roundTo6(line.weight - line.targetWeight);
  }

  // Compute daily change using previousClose prices
  let previousCloseValue = 0;
  for (const holding of portfolio.holdings) {
    const priceData = priceMap.get(holding.symbol);
    if (priceData) {
      previousCloseValue += holding.quantity * priceData.previousClose;
    }
  }
  previousCloseValue += portfolio.cash;

  const dayChangePct = previousCloseValue > 0
    ? roundTo6((totalValue - previousCloseValue) / previousCloseValue)
    : 0;

  return {
    portfolioId: portfolio.portfolioId,
    totalValue: roundTo2(totalValue),
    cash: portfolio.cash,
    asOf: now,
    allocations,
    dayChangePct,
    previousCloseValue: roundTo2(previousCloseValue),
  };
};

/** Round to 2 decimal places (USD). */
const roundTo2 = (n: number): number => Math.round(n * 100) / 100;

/** Round to 6 decimal places (percentages/weights). */
const roundTo6 = (n: number): number => Math.round(n * 1_000_000) / 1_000_000;
