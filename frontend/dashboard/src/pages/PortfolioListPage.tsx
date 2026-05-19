import { useCallback, useMemo } from 'react';
import { api } from '../api/client';
import type { Insight, Portfolio, Valuation } from '../types';
import { usePolling } from '../hooks/usePolling';
import { RiskBadge } from '../components/RiskBadge';
import { InsightPanel } from '../components/InsightPanel';
import { MarketPrices } from '../components/MarketPrices';
import { formatCurrency, formatPercent, formatRelativeTime } from '../utils/format';

interface PortfolioListPageProps {
  onSelect: (portfolioId: string) => void;
}

const POLL_MS = 5000;

/**
 * Landing page:
 * - Top: live market prices for all 20 equities
 * - Middle: portfolio grid with current values
 * - Right: AI alerts feed
 */
export function PortfolioListPage({ onSelect }: PortfolioListPageProps) {
  const fetchPortfolios = useCallback(() => api.listPortfolios(), []);
  const fetchInsights = useCallback(() => api.getLatestInsights(20), []);
  const fetchPrices = useCallback(() => api.getPrices(), []);
  const fetchValuations = useCallback(() => api.getLatestValuations(), []);

  const portfolios = usePolling(fetchPortfolios, POLL_MS);
  const insights = usePolling(fetchInsights, POLL_MS);
  const prices = usePolling(fetchPrices, POLL_MS);
  const valuations = usePolling(fetchValuations, POLL_MS);

  // Map portfolioId -> latest insight
  const latestInsightByPortfolio = useMemo(() => {
    const map = new Map<string, Insight>();
    for (const insight of insights.data?.insights ?? []) {
      const existing = map.get(insight.portfolioId);
      if (!existing || insight.generatedAt > existing.generatedAt) {
        map.set(insight.portfolioId, insight);
      }
    }
    return map;
  }, [insights.data]);

  // Map portfolioId -> latest valuation
  const valuationByPortfolio = useMemo(() => {
    const map = new Map<string, Valuation>();
    for (const v of valuations.data?.valuations ?? []) {
      map.set(v.portfolioId, v);
    }
    return map;
  }, [valuations.data]);

  const portfolioList: Portfolio[] = portfolios.data?.portfolios ?? [];

  return (
    <div className="page page--list">
      <div className="page__left">
        {/* Market Prices Section */}
        <section className="panel">
          <MarketPrices
            prices={prices.data?.prices ?? []}
            loading={prices.loading}
          />
        </section>

        {/* Portfolio Grid Section */}
        <section className="panel">
          <header className="panel__header">
            <h2>Client Portfolios ({portfolios.data?.count ?? 0})</h2>
            {portfolios.lastUpdated && (
              <span className="muted">Updated {formatRelativeTime(portfolios.lastUpdated.toISOString())}</span>
            )}
          </header>

          {portfolios.error && (
            <div className="error-banner">Failed to load portfolios: {portfolios.error.message}</div>
          )}

          {portfolios.loading && portfolioList.length === 0 ? (
            <div className="loading">Loading portfolios…</div>
          ) : (
            <div className="portfolio-grid">
              {portfolioList.map((portfolio) => {
                const insight = latestInsightByPortfolio.get(portfolio.portfolioId);
                const valuation = valuationByPortfolio.get(portfolio.portfolioId);
                return (
                  <button
                    key={portfolio.portfolioId}
                    type="button"
                    className="portfolio-card"
                    onClick={() => onSelect(portfolio.portfolioId)}
                  >
                    <div className="portfolio-card__top">
                      <span className="portfolio-card__id">{portfolio.portfolioId}</span>
                      {insight ? (
                        <RiskBadge severity={insight.severity} size="sm" />
                      ) : (
                        <span className="risk-badge risk-badge--none risk-badge--sm">OK</span>
                      )}
                    </div>
                    <h3 className="portfolio-card__name">{portfolio.name}</h3>
                    {valuation ? (
                      <div className="portfolio-card__value">
                        <span className="portfolio-card__total">
                          {formatCurrency(valuation.totalValue)}
                        </span>
                        <span className={`portfolio-card__change ${valuation.dayChangePct >= 0 ? 'change--up' : 'change--down'}`}>
                          {valuation.dayChangePct >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(valuation.dayChangePct))}
                        </span>
                      </div>
                    ) : (
                      <div className="portfolio-card__value">
                        <span className="muted">Awaiting valuation…</span>
                      </div>
                    )}
                    <div className="portfolio-card__meta">
                      <span>Holdings: {portfolio.holdings.length}</span>
                      {insight && (
                        <span className="muted">
                          Alert: {formatRelativeTime(insight.generatedAt)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* AI Alerts Column (unchanged) */}
      <section className="panel page__right">
        <header className="panel__header">
          <h2>AI Risk Alerts</h2>
          {insights.lastUpdated && (
            <span className="muted">Updated {formatRelativeTime(insights.lastUpdated.toISOString())}</span>
          )}
        </header>
        <InsightPanel
          insights={insights.data?.insights ?? []}
          loading={insights.loading}
          error={insights.error}
          emptyMessage="No alerts triggered yet. Waiting for risk breaches…"
          showPortfolioId
        />
      </section>
    </div>
  );
}
