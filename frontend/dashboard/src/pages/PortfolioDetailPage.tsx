import { useCallback } from 'react';
import { api } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { InsightPanel } from '../components/InsightPanel';
import { RiskBadge } from '../components/RiskBadge';
import { formatCurrency, formatPercent, formatRelativeTime } from '../utils/format';

interface PortfolioDetailPageProps {
  portfolioId: string;
}

const POLL_MS = 5000;

/**
 * Detailed view of a single portfolio:
 * - Holdings + target allocations
 * - Most recent risk classification + AI commentary
 * - Last alert timestamp
 */
export function PortfolioDetailPage({ portfolioId }: PortfolioDetailPageProps) {
  const fetchPortfolio = useCallback(() => api.getPortfolio(portfolioId), [portfolioId]);
  const fetchInsights = useCallback(
    () => api.getPortfolioInsights(portfolioId, 10),
    [portfolioId],
  );

  const portfolio = usePolling(fetchPortfolio, POLL_MS);
  const insights = usePolling(fetchInsights, POLL_MS);

  const latestInsight = insights.data?.insights[0] ?? null;
  const portfolioData = portfolio.data;

  return (
    <div className="page page--detail">
      <section className="panel">
        <header className="panel__header">
          <div>
            <h2 className="portfolio-detail__title">
              {portfolioData?.name ?? portfolioId}
            </h2>
            <div className="muted">
              <code>{portfolioId}</code>
              {portfolioData && <> · Client: <code>{portfolioData.clientId}</code></>}
            </div>
          </div>
          {latestInsight ? (
            <RiskBadge severity={latestInsight.severity} size="lg" />
          ) : (
            <span className="risk-badge risk-badge--none risk-badge--lg">OK</span>
          )}
        </header>

        {portfolio.error && (
          <div className="error-banner">Failed to load portfolio: {portfolio.error.message}</div>
        )}

        {portfolio.loading && !portfolioData ? (
          <div className="loading">Loading portfolio…</div>
        ) : portfolioData ? (
          <>
            <div className="metric-row">
              <Metric label="Cash" value={formatCurrency(portfolioData.cash, true)} />
              <Metric label="Holdings" value={String(portfolioData.holdings.length)} />
              {latestInsight && (
                <Metric
                  label="Last alert"
                  value={formatRelativeTime(latestInsight.generatedAt)}
                />
              )}
            </div>

            <h3 className="section-title">Holdings &amp; Target Allocation</h3>
            <div className="table-wrap">
              <table className="holdings-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Quantity</th>
                    <th>Target Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioData.holdings.map((holding) => {
                    const target = portfolioData.targetAllocation.find(
                      (t) => t.symbol === holding.symbol,
                    );
                    return (
                      <tr key={holding.symbol}>
                        <td><code>{holding.symbol}</code></td>
                        <td>{holding.quantity}</td>
                        <td>{target ? formatPercent(target.weight) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="panel">
        <header className="panel__header">
          <h2>AI Commentary &amp; Alerts</h2>
          {insights.lastUpdated && (
            <span className="muted">
              Updated {formatRelativeTime(insights.lastUpdated.toISOString())}
            </span>
          )}
        </header>
        <InsightPanel
          insights={insights.data?.insights ?? []}
          loading={insights.loading}
          error={insights.error}
          emptyMessage="No alerts for this portfolio yet."
        />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric__label">{label}</div>
      <div className="metric__value">{value}</div>
    </div>
  );
}
