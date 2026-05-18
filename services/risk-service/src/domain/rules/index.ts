import { SEVERITY } from '@prr/shared';
import type { Valuation, Breach, Severity } from '@prr/shared';
import { checkAllocationDrift } from './allocation-drift.rule.js';
import { checkSingleStockExposure } from './single-stock.rule.js';
import { checkDailyDrop } from './daily-drop.rule.js';

/**
 * Risk Rules Engine — aggregates all rule checks into a single call.
 *
 * Deterministic, code-driven. The LLM NEVER performs financial calculations.
 * This function is the single point of rule evaluation.
 */
export const evaluateRules = (valuation: Valuation): Breach[] => {
  const breaches: Breach[] = [
    ...checkAllocationDrift(valuation),
    ...checkSingleStockExposure(valuation),
    ...checkDailyDrop(valuation),
  ];
  return breaches;
};

/**
 * Determine the overall severity across multiple breaches.
 * Returns the highest severity found.
 */
export const getOverallSeverity = (breaches: Breach[]): Severity => {
  const severityOrder: Severity[] = [SEVERITY.HIGH, SEVERITY.MEDIUM, SEVERITY.LOW];
  for (const s of severityOrder) {
    if (breaches.some((b) => b.severity === s)) return s;
  }
  return SEVERITY.LOW;
};

export { checkAllocationDrift } from './allocation-drift.rule.js';
export { checkSingleStockExposure } from './single-stock.rule.js';
export { checkDailyDrop } from './daily-drop.rule.js';
