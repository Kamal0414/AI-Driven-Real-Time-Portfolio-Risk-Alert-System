/**
 * Project-wide constants. Kept dependency-free so they can be imported from
 * any service (Lambda handler, CDK infra, frontend) without pulling AWS SDKs.
 */

/** EventBridge bus name (overridable via env). */
export const EVENT_BUS_NAME = 'portfolio-risk-bus';

/** Source identifier for events emitted by our services on the custom bus. */
export const EVENT_SOURCE = {
  PORTFOLIO: 'prr.portfolio-service',
  MARKET_DATA: 'prr.market-data-service',
  RISK: 'prr.risk-service',
  AI_INSIGHT: 'prr.ai-insight-service',
} as const;
export type EventSource = (typeof EVENT_SOURCE)[keyof typeof EVENT_SOURCE];

/** Canonical event type names (detail-type on EventBridge). */
export const EVENT_TYPE = {
  PRICE_UPDATED: 'PriceUpdated',
  PORTFOLIO_UPDATED: 'PortfolioUpdated',
  PORTFOLIO_REVALUED: 'PortfolioRevalued',
  RISK_THRESHOLD_BREACHED: 'RiskThresholdBreached',
  AI_INSIGHT_GENERATED: 'AIInsightGenerated',
} as const;
export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

/** Schema version for the envelope. Bump on breaking change. */
export const SCHEMA_VERSION = '1.0';

/** Risk thresholds — single source of truth used by Risk Service rules. */
export const RISK_THRESHOLDS = {
  /** Allocation drift > 5% from target weight. */
  ALLOCATION_DRIFT: 0.05,
  /** Single-stock exposure > 20% of total portfolio value. */
  SINGLE_STOCK_EXPOSURE: 0.2,
  /** Daily portfolio value drop > 3%. */
  DAILY_PORTFOLIO_DROP: 0.03,
} as const;

/** Severity classification used across risk + AI events. */
export const SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];

/** Breach types emitted by the rules engine. */
export const BREACH_TYPE = {
  ALLOCATION_DRIFT: 'ALLOCATION_DRIFT',
  SINGLE_STOCK_EXPOSURE: 'SINGLE_STOCK_EXPOSURE',
  DAILY_PORTFOLIO_DROP: 'DAILY_PORTFOLIO_DROP',
} as const;
export type BreachType = (typeof BREACH_TYPE)[keyof typeof BREACH_TYPE];

/**
 * The 20 equities used across the simulator and seeded portfolios.
 * Mixed sectors so allocation drift and concentration scenarios are realistic.
 */
export const SUPPORTED_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META',
  'NVDA', 'TSLA', 'JPM', 'BAC', 'WFC',
  'XOM', 'CVX', 'PFE', 'JNJ', 'UNH',
  'WMT', 'KO', 'PEP', 'DIS', 'NFLX',
] as const;
/** Use this instead of the global `Symbol` to avoid shadowing. */
export type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];

/** DynamoDB table names — overridden via env vars at runtime. */
export const TABLE_NAMES = {
  PORTFOLIOS: 'Portfolios',
  PRICES: 'Prices',
  VALUATIONS: 'Valuations',
  ALERTS: 'Alerts',
  INSIGHTS: 'Insights',
} as const;

/** Environment variable keys consumed by services. Centralised to avoid typos. */
export const ENV = {
  EVENT_BUS_NAME: 'EVENT_BUS_NAME',
  AWS_REGION: 'AWS_REGION',
  LOG_LEVEL: 'LOG_LEVEL',
  TABLE_PORTFOLIOS: 'TABLE_PORTFOLIOS',
  TABLE_PRICES: 'TABLE_PRICES',
  TABLE_VALUATIONS: 'TABLE_VALUATIONS',
  TABLE_ALERTS: 'TABLE_ALERTS',
  TABLE_INSIGHTS: 'TABLE_INSIGHTS',
  LLM_PROVIDER: 'LLM_PROVIDER',
  LLM_API_KEY_PARAM: 'LLM_API_KEY_PARAM',
  LLM_MODEL: 'LLM_MODEL',
} as const;
