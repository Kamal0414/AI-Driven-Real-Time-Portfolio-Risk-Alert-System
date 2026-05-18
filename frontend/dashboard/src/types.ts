/**
 * Frontend type definitions.
 *
 * Mirrors the backend domain types from @prr/shared but kept local
 * to keep the frontend bundle minimal and decoupled from backend deps.
 */

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export type BreachType =
  | 'ALLOCATION_DRIFT'
  | 'SINGLE_STOCK_EXPOSURE'
  | 'DAILY_PORTFOLIO_DROP';

export interface Holding {
  symbol: string;
  quantity: number;
}

export interface TargetAllocation {
  symbol: string;
  weight: number;
}

export interface Portfolio {
  portfolioId: string;
  clientId: string;
  name: string;
  cash: number;
  holdings: Holding[];
  targetAllocation: TargetAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface AllocationLine {
  symbol: string;
  quantity: number;
  price: number;
  value: number;
  weight: number;
  targetWeight: number;
  drift: number;
}

export interface Valuation {
  portfolioId: string;
  totalValue: number;
  cash: number;
  asOf: string;
  allocations: AllocationLine[];
  dayChangePct: number;
  previousCloseValue: number;
}

export interface BreachMetrics {
  symbol?: string;
  actualValue: number;
  targetValue: number;
  deviation: number;
}

export interface Alert {
  portfolioId: string;
  breachKey: string;
  clientId: string;
  type: BreachType;
  severity: Severity;
  metrics: BreachMetrics;
  thresholdRule: string;
  message: string;
  portfolioValue: number;
  asOf: string;
  createdAt: string;
}

export interface Insight {
  portfolioId: string;
  generatedAt: string;
  generatedBy: string;
  modelVersion?: string;
  fallback: boolean;
  correlationId: string;
  headline: string;
  explanation: string;
  suggestedAction: string;
  severity: Severity;
  disclaimer: string;
}

/** Standard API response envelope from the backend. */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
export interface ApiError {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
