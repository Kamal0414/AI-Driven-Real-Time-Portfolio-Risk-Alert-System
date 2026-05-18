import type { Insight } from '../types';
import { AlertCard } from './AlertCard';

interface InsightPanelProps {
  insights: Insight[];
  loading: boolean;
  error: Error | null;
  emptyMessage?: string;
  showPortfolioId?: boolean;
}

/** List of insights with consistent loading + error + empty handling. */
export function InsightPanel({
  insights,
  loading,
  error,
  emptyMessage = 'No alerts yet.',
  showPortfolioId = false,
}: InsightPanelProps) {
  if (loading && insights.length === 0) {
    return <div className="loading">Loading insights…</div>;
  }
  if (error) {
    return <div className="error-banner">Failed to load insights: {error.message}</div>;
  }
  if (insights.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }
  return (
    <div className="insight-panel">
      {insights.map((insight) => (
        <AlertCard
          key={`${insight.portfolioId}#${insight.generatedAt}`}
          insight={insight}
          showPortfolioId={showPortfolioId}
        />
      ))}
    </div>
  );
}
