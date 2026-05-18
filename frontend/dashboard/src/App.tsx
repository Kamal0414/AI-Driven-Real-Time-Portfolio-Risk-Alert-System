import { useState } from 'react';
import { PortfolioListPage } from './pages/PortfolioListPage';
import { PortfolioDetailPage } from './pages/PortfolioDetailPage';
import { LiveIndicator } from './components/LiveIndicator';
import { apiBaseUrl } from './api/client';

/** Safely extract a host label from the API URL. */
function apiHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Root application component.
 *
 * Routing is handled with a tiny in-memory state to keep the bundle small —
 * we don't need react-router for two views. Could be upgraded later.
 */
export function App() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__left">
          {selectedPortfolioId ? (
            <button
              type="button"
              className="back-button"
              onClick={() => setSelectedPortfolioId(null)}
            >
              ← All portfolios
            </button>
          ) : (
            <h1 className="app-title">Portfolio Risk Dashboard</h1>
          )}
        </div>
        <div className="app-header__right">
          <LiveIndicator />
          <span className="api-badge" title={apiBaseUrl}>
            API: {apiHost(apiBaseUrl)}
          </span>
        </div>
      </header>

      <main className="app-main">
        {selectedPortfolioId ? (
          <PortfolioDetailPage portfolioId={selectedPortfolioId} />
        ) : (
          <PortfolioListPage onSelect={setSelectedPortfolioId} />
        )}
      </main>

      <footer className="app-footer">
        <span>AI-Driven Portfolio Risk Alert System &mdash; MVP demo</span>
      </footer>
    </div>
  );
}
