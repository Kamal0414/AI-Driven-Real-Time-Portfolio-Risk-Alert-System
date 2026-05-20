import { SUPPORTED_SYMBOLS } from '@prr/shared';
import type { Price } from '@prr/shared';

/**
 * Price Simulator — bounded random walk for 20 equities.
 *
 * Each tick:
 * 1. Loads previous prices (or seeds with realistic starting prices).
 * 2. Applies a small random change (-1.5% to +1.5%) per symbol.
 * 3. Clamps prices within [floor, ceiling] to prevent unrealistic drift.
 * 4. Returns the new price snapshot.
 *
 * The previousClose is set once per "trading day" (reset when the date changes).
 * Within a day, previousClose stays constant — used by the Risk Service
 * to compute daily P&L.
 */

/** Realistic starting prices (USD) for each of our 20 equities. */
export const SEED_PRICES: Record<string, number> = {
  AAPL: 185.0, MSFT: 420.0, GOOGL: 175.0, AMZN: 185.0, META: 500.0,
  NVDA: 130.0, TSLA: 250.0, JPM: 195.0, BAC: 37.0, WFC: 55.0,
  XOM: 115.0, CVX: 155.0, PFE: 28.0, JNJ: 155.0, UNH: 520.0,
  WMT: 165.0, KO: 60.0, PEP: 170.0, DIS: 110.0, NFLX: 620.0,
};

/**
 * Price bounds to prevent prices from drifting to unrealistic values
 * during extended simulation runs.
 */
const PRICE_FLOOR_FACTOR = 0.5;   // min = 50% of seed price
const PRICE_CEILING_FACTOR = 2.0; // max = 200% of seed price

/**
 * Maximum per-tick change as a fraction of current price.
 *
 * Set to ±3% to ensure all 3 risk rules can realistically trigger during
 * a demo session. With ±1.5%, allocation drift and daily-drop alerts
 * almost never fire because random walks tend to mean-revert. ±3% allows
 * cumulative drift to build up over ~30-60 ticks (3-7 minutes at 7s tick
 * rate) and gives genuine intraday drawdowns a real chance.
 */
const MAX_TICK_CHANGE = 0.03; // ±3%

/**
 * Generate a random price change using a normal-ish distribution.
 * Box-Muller transform gives us more realistic movements
 * (small moves frequent, big moves rare).
 */
const randomChange = (): number => {
  const u1 = Math.random();
  const u2 = Math.random();
  // Standard normal via Box-Muller, scaled to our max range
  const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
  // Scale so ~99% of values fall within ±MAX_TICK_CHANGE
  return (z / 3) * MAX_TICK_CHANGE;
};

/**
 * Clamp a value between min and max.
 */
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Round to 2 decimal places (cents).
 */
const roundPrice = (value: number): number =>
  Math.round(value * 100) / 100;

export interface PreviousPriceData {
  symbol: string;
  price: number;
  previousClose: number;
  /** ISO date string of when previousClose was last set (e.g. "2026-05-18") */
  lastCloseDate?: string;
}

/**
 * Simulate one tick of price movement for all 20 equities.
 *
 * @param currentPrices - The prices from the previous tick (undefined = first tick, use seeds)
 * @returns Array of new Price objects ready to persist and publish
 */
export const simulateTick = (
  currentPrices: PreviousPriceData[] | undefined,
): Price[] => {
  const now = new Date();
  const asOf = now.toISOString();
  const today = asOf.slice(0, 10); // "YYYY-MM-DD"

  return SUPPORTED_SYMBOLS.map((symbol) => {
    const seedPrice = SEED_PRICES[symbol] ?? 100;
    const floor = roundPrice(seedPrice * PRICE_FLOOR_FACTOR);
    const ceiling = roundPrice(seedPrice * PRICE_CEILING_FACTOR);

    // Find existing price data for this symbol
    const existing = currentPrices?.find((p) => p.symbol === symbol);

    let currentPrice: number;
    let previousClose: number;

    if (!existing) {
      // First tick ever — seed with base prices
      // Add small random offset so not all portfolios start perfectly aligned
      const initialJitter = (Math.random() - 0.5) * 0.02 * seedPrice;
      currentPrice = roundPrice(seedPrice + initialJitter);
      previousClose = seedPrice;
    } else {
      // Apply random walk
      const change = randomChange();
      const newPrice = existing.price * (1 + change);
      currentPrice = roundPrice(clamp(newPrice, floor, ceiling));

      // Reset previousClose at the start of a new day
      if (existing.lastCloseDate && existing.lastCloseDate !== today) {
        // New day — yesterday's last price becomes today's previousClose
        previousClose = existing.price;
      } else {
        // Same day — keep the existing previousClose
        previousClose = existing.previousClose;
      }
    }

    return {
      symbol,
      price: currentPrice,
      previousClose,
      asOf,
    };
  });
};
