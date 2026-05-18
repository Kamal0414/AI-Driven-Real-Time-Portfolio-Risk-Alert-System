import type { RiskThresholdBreachedData } from '@prr/shared';

export const SYSTEM_PROMPT = `You are a portfolio risk analyst assistant. You generate clear, concise commentary explaining risk threshold breaches detected in client investment portfolios.

Output MUST be valid JSON matching this exact schema:
{
  "headline": "string (max 140 chars)",
  "explanation": "string (max 1200 chars)",
  "suggestedAction": "string (max 800 chars)",
  "severity": "LOW | MEDIUM | HIGH",
  "disclaimer": "string (advisory disclaimer)"
}

Rules:
- Never make financial guarantees or predictions
- Never speculate about future price movements
- Always include a disclaimer`;

export const buildBreachPrompt = (data: RiskThresholdBreachedData): string => {
  const breachSummaries = data.breaches.map((b, i) => {
    const symbolInfo = b.metrics.symbol ? ` (symbol: ${b.metrics.symbol})` : '';
    return `  ${i + 1}. Type: ${b.type}${symbolInfo}
     Severity: ${b.severity}
     Rule: ${b.thresholdRule}
     Details: ${b.message}
     Metrics: actualValue=${b.metrics.actualValue}, targetValue=${b.metrics.targetValue}, deviation=${b.metrics.deviation}`;
  }).join('\n');

  return `Analyze the following risk breach(es) for portfolio ${data.portfolioId}:

Portfolio Value: $${data.portfolioValue.toFixed(2)}
Overall Severity: ${data.overallSeverity}
Timestamp: ${data.asOf}
Number of Breaches: ${data.breaches.length}

Breach Details:
${breachSummaries}

Generate a JSON response with headline, explanation, suggestedAction, severity, and disclaimer.`;
};
