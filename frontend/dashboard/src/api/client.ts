import type { ApiResponse, Portfolio, Insight, Valuation } from '../types';

/**
 * API client for the Portfolio Risk Alert backend.
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new ApiClientError(0, 'NETWORK_ERROR', `Network error reaching ${url}: ${(err as Error).message}`);
  }

  let body: ApiResponse<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text) as ApiResponse<T>;
    } catch {
      throw new ApiClientError(response.status, 'INVALID_JSON', `Non-JSON response: ${text.slice(0, 200)}`);
    }
  }

  if (!response.ok || !body || body.ok === false) {
    const code = body && body.ok === false ? body.error.code : 'HTTP_ERROR';
    const message = body && body.ok === false ? body.error.message : `HTTP ${response.status}`;
    throw new ApiClientError(response.status, code, message);
  }

  return body.data;
}

export interface ListPortfoliosResponse {
  portfolios: Portfolio[];
  count: number;
}

export interface ListInsightsResponse {
  insights: Insight[];
  count: number;
}

export interface PriceData {
  symbol: string;
  price: number;
  previousClose: number;
  asOf: string;
}

export interface ListPricesResponse {
  prices: PriceData[];
  count: number;
}

export interface ListValuationsResponse {
  valuations: Valuation[];
  count: number;
}

export interface GetValuationResponse {
  valuation: Valuation | null;
}

export const api = {
  listPortfolios: (): Promise<ListPortfoliosResponse> => request('/portfolios'),
  getPortfolio: (id: string): Promise<Portfolio> => request(`/portfolios/${encodeURIComponent(id)}`),
  getPortfolioInsights: (id: string, limit = 10): Promise<ListInsightsResponse> =>
    request(`/portfolios/${encodeURIComponent(id)}/insights?limit=${limit}`),
  getLatestInsights: (limit = 20): Promise<ListInsightsResponse> =>
    request(`/insights/latest?limit=${limit}`),
  getPrices: (): Promise<ListPricesResponse> => request('/prices'),
  getLatestValuations: (): Promise<ListValuationsResponse> => request('/valuations/latest'),
  getPortfolioValuation: (id: string): Promise<GetValuationResponse> =>
    request(`/portfolios/${encodeURIComponent(id)}/valuation`),
};

export { ApiClientError };
export const apiBaseUrl = API_BASE_URL;
