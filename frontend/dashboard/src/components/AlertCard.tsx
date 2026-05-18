import type { Insight } from '../types';
import { RiskBadge } from './RiskBadge';

interface AlertCardProps {
  insight: Insight;
  showPortfolioId?: boolean;
}

/** Compact card displaying a single AI-generated insight. */
export function AlertCard({ insight, showPortfolioId = false }: AlertCardProps) {
  return (
    <article className={`alert-card severity-${insight.severity.toLowerCase()}`}>
      <header className="alert-card__header">
        <RiskBadge severity={insight.severity} size="sm" />
        <h3 className="alert-card__headline">{insight.headline}</h3>
        <time className="alert-card__time" dateTime={insight.generatedAt}>
          {new Date(insight.generatedAt).toLocaleTimeString()}
        </time>
      </header>

      {showPortfolioId && (
        <div className="alert-card__meta">
          Portfolio: <code>{insight.portfolioId}</code>
        </div>
      )}

      <p className="alert-card__explanation">{insight.explanation}</p>

      <div className="alert-card__action">
        <strong>Suggested action:</strong> {insight.suggestedAction}
      </div>

      <footer className="alert-card__footer">
        <span className="alert-card__provider">
          {insight.fallback ? 'fallback' : 'AI'} · {insight.generatedBy}
        </span>
        <span className="alert-card__disclaimer">{insight.disclaimer}</span>
      </footer>
    </article>
  );
}
