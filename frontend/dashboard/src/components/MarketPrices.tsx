import type { PriceData } from '../api/client';
import { formatCurrency, formatPercent, formatRelativeTime } from '../utils/format';

interface MarketPricesProps {
  prices: PriceData[];
  loading: boolean;
}

/** Compact table showing current market prices for all 20 equities. */
export function MarketPrices({ prices, loading }: MarketPricesProps) {
  if (loading && prices.length === 0) {
    return <div className="loading">Loading market data…</div>;
  }
  if (prices.length === 0) {
    return <div className="empty-state">Waiting for first price tick…</div>;
  }

  const lastUpdate = prices[0]?.asOf;

  return (
    <div className="market-prices">
      <div className="market-prices__header">
        <h3 className="section-title">Live Market Prices</h3>
        {lastUpdate && (
          <span className="muted">Updated {formatRelativeTime(lastUpdate)}</span>
        )}
      </div>
      <div className="market-prices__grid">
        {prices.map((p) => {
          const change = p.price - p.previousClose;
          const changePct = p.previousClose > 0 ? change / p.previousClose : 0;
          const isUp = change >= 0;
          return (
            <div key={p.symbol} className={`price-chip ${isUp ? 'price-chip--up' : 'price-chip--down'}`}>
              <span className="price-chip__symbol">{p.symbol}</span>
              <span className="price-chip__price">{formatCurrency(p.price, true)}</span>
              <span className="price-chip__change">
                {isUp ? '▲' : '▼'} {formatPercent(changePct)}
              </span>
              <span className="price-chip__prev">
                Prev: {formatCurrency(p.previousClose, true)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
