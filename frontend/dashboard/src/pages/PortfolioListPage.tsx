import { useCallback, useMemo } from 'react';
import { api } from '../api/client';
import type { Insight, Portfolio } from '../types';
import { usePolling } from '../hooks/usePolling';
import { RiskBadge } from '../components/RiskBadge';
import { InsightPanel } from '../components/InsightPanel';
import { formatRelativeTime } from '../utils/format';

interface PortfolioListPageProps {
  onSelect: (portfolioId: string) => void;
}

const POLL_MS = 5000;

/**
 * Landing page — shows the list of portfolios + a global feed of latest AI alerts.
 */
export function PortfolioListPage({ onSelect }: PortfolioListPageProps) {
  const fetchPortfolios = useCallback(() => api.listPortfolios(), []);
  const fetchInsights = useCallback(() => api.getLatestInsights(20), []);

  const portfolios = usePolling(fetchPortfolios, POLL_MS);
  const insights = usePolling(fetchInsights, POLL_MS);

  // Build a map of portfolioId -> latest insight for quick lookup
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

  const portfolioList: Portfolio[] = portfolios.data?.portfolios ?? [];

  return (
    <div className="page page--list">
      <section className="panel">
        <header className="panel__header">
          <h2>Portfolios ({portfolios.data?.count ?? 0})</h2>
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
                  <div className="portfolio-card__meta">
                    <span>Holdings: {portfolio.holdings.length}</span>
                    {insight && (
                      <span className="muted">
                        Last alert: {formatRelativeTime(insight.generatedAt)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <header className="panel__header">
          <h2>Latest AI Alerts</h2>
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
