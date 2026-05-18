import { RISK_THRESHOLDS, BREACH_TYPE, SEVERITY } from '@prr/shared';
import type { Valuation, Breach } from '@prr/shared';

/**
 * Daily Portfolio Drop Rule
 *
 * Triggers when the portfolio value has dropped more than 3% within
 * the current trading day (compared to previousClose value).
 *
 * Severity:
 * - LOW:    drop > 3% and <= 5%
 * - MEDIUM: drop > 5% and <= 8%
 * - HIGH:   drop > 8%
 */
export const checkDailyDrop = (valuation: Valuation): Breach[] => {
  const threshold = RISK_THRESHOLDS.DAILY_PORTFOLIO_DROP;

  // dayChangePct is negative for drops (e.g. -0.035 = -3.5%)
  if (valuation.dayChangePct >= -threshold) {
    return []; // No breach — drop is within acceptable range
  }

  const absDrop = Math.abs(valuation.dayChangePct);
  const severity = classifySeverity(absDrop);

  return [
    {
      type: BREACH_TYPE.DAILY_PORTFOLIO_DROP,
      severity,
      metrics: {
        actualValue: valuation.dayChangePct,
        targetValue: -threshold,
        deviation: valuation.dayChangePct + threshold, // negative = how much beyond threshold
      },
      thresholdRule: `daily_drop>${(threshold * 100).toFixed(0)}%`,
      message: `Portfolio dropped ${(absDrop * 100).toFixed(2)}% today (threshold ${(threshold * 100).toFixed(0)}%), value $${valuation.totalValue.toFixed(2)} vs open $${valuation.previousCloseValue.toFixed(2)}`,
    },
  ];
};

const classifySeverity = (absDrop: number): typeof SEVERITY[keyof typeof SEVERITY] => {
  if (absDrop > 0.08) return SEVERITY.HIGH;
  if (absDrop > 0.05) return SEVERITY.MEDIUM;
  return SEVERITY.LOW;
};
