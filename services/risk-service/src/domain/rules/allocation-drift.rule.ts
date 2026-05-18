import { RISK_THRESHOLDS, BREACH_TYPE, SEVERITY } from '@prr/shared';
import type { Valuation, Breach } from '@prr/shared';

/**
 * Allocation Drift Rule
 *
 * Triggers when any symbol's actual weight deviates from its target weight
 * by more than 5% (absolute).
 *
 * Severity:
 * - LOW:    drift > 5% and <= 8%
 * - MEDIUM: drift > 8% and <= 12%
 * - HIGH:   drift > 12%
 */
export const checkAllocationDrift = (valuation: Valuation): Breach[] => {
  const breaches: Breach[] = [];
  const threshold = RISK_THRESHOLDS.ALLOCATION_DRIFT;

  for (const line of valuation.allocations) {
    const absDrift = Math.abs(line.drift);

    if (absDrift > threshold) {
      const severity = classifySeverity(absDrift);
      breaches.push({
        type: BREACH_TYPE.ALLOCATION_DRIFT,
        severity,
        metrics: {
          symbol: line.symbol,
          actualValue: line.weight,
          targetValue: line.targetWeight,
          deviation: line.drift,
        },
        thresholdRule: `allocation_drift>${(threshold * 100).toFixed(0)}%`,
        message: `${line.symbol} allocation is ${(line.weight * 100).toFixed(1)}% (target ${(line.targetWeight * 100).toFixed(1)}%), drift of ${(line.drift * 100).toFixed(1)}%`,
      });
    }
  }

  return breaches;
};

const classifySeverity = (absDrift: number): typeof SEVERITY[keyof typeof SEVERITY] => {
  if (absDrift > 0.12) return SEVERITY.HIGH;
  if (absDrift > 0.08) return SEVERITY.MEDIUM;
  return SEVERITY.LOW;
};
