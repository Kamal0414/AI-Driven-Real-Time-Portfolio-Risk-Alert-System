import { RISK_THRESHOLDS, BREACH_TYPE, SEVERITY } from '@prr/shared';
import type { Valuation, Breach } from '@prr/shared';

/**
 * Single Stock Exposure Rule
 *
 * Triggers when any single stock exceeds 20% of total portfolio value.
 *
 * Severity:
 * - LOW:    weight > 20% and <= 25%
 * - MEDIUM: weight > 25% and <= 35%
 * - HIGH:   weight > 35%
 */
export const checkSingleStockExposure = (valuation: Valuation): Breach[] => {
  const breaches: Breach[] = [];
  const threshold = RISK_THRESHOLDS.SINGLE_STOCK_EXPOSURE;

  for (const line of valuation.allocations) {
    if (line.weight > threshold) {
      const severity = classifySeverity(line.weight);
      const excess = line.weight - threshold;

      breaches.push({
        type: BREACH_TYPE.SINGLE_STOCK_EXPOSURE,
        severity,
        metrics: {
          symbol: line.symbol,
          actualValue: line.weight,
          targetValue: threshold,
          deviation: excess,
        },
        thresholdRule: `single_stock>${(threshold * 100).toFixed(0)}%`,
        message: `${line.symbol} is ${(line.weight * 100).toFixed(1)}% of portfolio, exceeding ${(threshold * 100).toFixed(0)}% limit by ${(excess * 100).toFixed(1)}%`,
      });
    }
  }

  return breaches;
};

const classifySeverity = (weight: number): typeof SEVERITY[keyof typeof SEVERITY] => {
  if (weight > 0.35) return SEVERITY.HIGH;
  if (weight > 0.25) return SEVERITY.MEDIUM;
  return SEVERITY.LOW;
};
