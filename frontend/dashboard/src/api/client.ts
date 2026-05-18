import type { ApiResponse, Portfolio, Insight } from '../types';

/**
 * API client for the Portfolio Risk Alert backend.
 *
 * Reads the base URL from VITE_API_URL at build time. Falls back to
 * http://localhost:3000 for local development.
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

export const api = {
  listPortfolios: (): Promise<ListPortfoliosResponse> => request('/portfolios'),
  getPortfolio: (id: string): Promise<Portfolio> => request(`/portfolios/${encodeURIComponent(id)}`),
  getPortfolioInsights: (id: string, limit = 10): Promise<ListInsightsResponse> =>
    request(`/portfolios/${encodeURIComponent(id)}/insights?limit=${limit}`),
  getLatestInsights: (limit = 20): Promise<ListInsightsResponse> =>
    request(`/insights/latest?limit=${limit}`),
};

export { ApiClientError };
export const apiBaseUrl = API_BASE_URL;
