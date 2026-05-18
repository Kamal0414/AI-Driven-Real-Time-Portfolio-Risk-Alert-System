/**
 * Seed script — generates 100 realistic client portfolios and writes them
 * to DynamoDB. Run once after deploying the DataStack:
 *
 *   npx ts-node --esm services/portfolio-service/src/seed/seed-100-portfolios.ts
 *
 * Or via the npm script:
 *
 *   npm run seed -w @prr/portfolio-service
 *
 * Requires AWS credentials configured (e.g. via `aws configure` or env vars).
 * Set TABLE_PORTFOLIOS env var if the table name differs from the default.
 */

import { SUPPORTED_SYMBOLS } from '@prr/shared';
import type { Portfolio, Holding, TargetAllocation } from '@prr/shared';
import { batchCreatePortfolios } from '../repo/portfolio.repo.js';

// ─── Configuration ────────────────────────────────────────────────

const TOTAL_PORTFOLIOS = 100;
const MIN_HOLDINGS = 5;
const MAX_HOLDINGS = 12;

/** Realistic starting prices used for initial quantity calculation. */
const REFERENCE_PRICES: Record<string, number> = {
  AAPL: 185, MSFT: 420, GOOGL: 175, AMZN: 185, META: 500,
  NVDA: 130, TSLA: 250, JPM: 195, BAC: 37, WFC: 55,
  XOM: 115, CVX: 155, PFE: 28, JNJ: 155, UNH: 520,
  WMT: 165, KO: 60, PEP: 170, DIS: 110, NFLX: 620,
};

/** Client name patterns for realistic-looking data. */
const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy',
  'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra', 'Steven', 'Ashley',
  'Paul', 'Dorothy', 'Andrew', 'Kimberly', 'Joshua', 'Emily', 'Kenneth', 'Donna',
  'Kevin', 'Michelle', 'Brian', 'Carol', 'George', 'Amanda', 'Timothy', 'Melissa',
  'Ronald', 'Deborah',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts',
];

const PORTFOLIO_STYLES = [
  'Growth Portfolio', 'Balanced Fund', 'Income Strategy', 'Value Portfolio',
  'Tech-Heavy Growth', 'Dividend Focus', 'Conservative Mix', 'Aggressive Growth',
  'Blue Chip Core', 'Sector Rotation',
];

// ─── Helpers ──────────────────────────────────────────────────────

const rand = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T>(arr: readonly T[]): T => arr[rand(0, arr.length - 1)];

const shuffle = <T>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Generate random target weights that sum to exactly 1.0.
 * Uses the "broken stick" method for natural-looking allocations.
 */
const generateWeights = (count: number): number[] => {
  // Generate random breakpoints, sort, compute intervals
  const points = Array.from({ length: count - 1 }, () => Math.random()).sort((a, b) => a - b);
  const weights: number[] = [];

  let prev = 0;
  for (const p of points) {
    weights.push(p - prev);
    prev = p;
  }
  weights.push(1 - prev);

  // Round to 4 decimal places, then fix the last weight to ensure exact sum = 1
  const rounded = weights.map((w) => Math.round(w * 10000) / 10000);
  const sum = rounded.reduce((s, w) => s + w, 0);
  rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + (1 - sum)) * 10000) / 10000;

  return rounded;
};

/** Generate a single portfolio. */
const generatePortfolio = (index: number): Portfolio => {
  const numHoldings = rand(MIN_HOLDINGS, MAX_HOLDINGS);
  const selectedSymbols = shuffle([...SUPPORTED_SYMBOLS]).slice(0, numHoldings);
  const weights = generateWeights(numHoldings);

  // Simulate a portfolio value between $50k and $500k
  const portfolioValue = rand(50_000, 500_000);
  const cashPct = Math.random() * 0.05; // 0-5% cash
  const investedValue = portfolioValue * (1 - cashPct);
  const cash = Math.round(portfolioValue * cashPct * 100) / 100;

  const holdings: Holding[] = selectedSymbols.map((symbol, i) => {
    const targetValue = investedValue * weights[i];
    const price = REFERENCE_PRICES[symbol] ?? 100;
    const quantity = Math.max(1, Math.round(targetValue / price));
    return { symbol, quantity };
  });

  const targetAllocation: TargetAllocation[] = selectedSymbols.map((symbol, i) => ({
    symbol,
    weight: weights[i],
  }));

  const paddedIndex = String(index + 1).padStart(4, '0');
  const now = new Date().toISOString();

  return {
    portfolioId: `p-${paddedIndex}`,
    clientId: `c-${paddedIndex}`,
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} — ${pick(PORTFOLIO_STYLES)}`,
    cash,
    holdings,
    targetAllocation,
    createdAt: now,
    updatedAt: now,
  };
};

// ─── Main ─────────────────────────────────────────────────────────

const main = async (): Promise<void> => {
  console.log(`Generating ${TOTAL_PORTFOLIOS} portfolios...`);

  const portfolios: Portfolio[] = [];
  for (let i = 0; i < TOTAL_PORTFOLIOS; i++) {
    portfolios.push(generatePortfolio(i));
  }

  // Validate all portfolios pass Zod
  const { PortfolioSchema } = await import('@prr/shared');
  let valid = 0;
  for (const p of portfolios) {
    const result = PortfolioSchema.safeParse(p);
    if (!result.success) {
      console.error(`Portfolio ${p.portfolioId} failed validation:`, result.error.flatten());
    } else {
      valid++;
    }
  }
  console.log(`Validation: ${valid}/${portfolios.length} portfolios valid`);

  if (valid !== portfolios.length) {
    console.error('Some portfolios failed validation — aborting');
    process.exit(1);
  }

  console.log('Writing to DynamoDB...');
  await batchCreatePortfolios(portfolios);
  console.log(`✅ Successfully seeded ${portfolios.length} portfolios`);

  // Print a sample
  console.log('\nSample portfolio:');
  console.log(JSON.stringify(portfolios[0], null, 2));
};

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
