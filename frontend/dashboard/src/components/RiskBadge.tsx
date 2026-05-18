import type { Severity } from '../types';

interface RiskBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md' | 'lg';
}

/** Color-coded severity badge: LOW (green), MEDIUM (amber), HIGH (red). */
export function RiskBadge({ severity, size = 'md' }: RiskBadgeProps) {
  const className = `risk-badge risk-badge--${severity.toLowerCase()} risk-badge--${size}`;
  return <span className={className}>{severity}</span>;
}
