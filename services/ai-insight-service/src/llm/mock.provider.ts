import type { InsightPayload } from '@prr/shared';
import type { LLMProvider } from './provider.js';

/**
 * Mock LLM Provider — generates deterministic, realistic commentary
 * without calling any external API. Zero cost, zero latency, always works.
 */
export class MockProvider implements LLMProvider {
  readonly name = 'mock';
  readonly modelVersion = 'mock-v1';

  async generate(prompt: string): Promise<InsightPayload> {
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

    const hasAllocationDrift = prompt.includes('ALLOCATION_DRIFT');
    const hasSingleStock = prompt.includes('SINGLE_STOCK_EXPOSURE');
    const hasDailyDrop = prompt.includes('DAILY_PORTFOLIO_DROP');

    const symbolMatch = prompt.match(/symbol['":\s]+([A-Z]{2,5})/);
    const symbol = symbolMatch ? symbolMatch[1] : 'the position';

    const severityMatch = prompt.match(/Overall Severity['":\s]+(HIGH|MEDIUM|LOW)/i);
    const severity = (severityMatch ? severityMatch[1]!.toUpperCase() : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW';

    let headline: string;
    let explanation: string;
    let suggestedAction: string;

    if (hasDailyDrop) {
      headline = `Significant daily decline detected`;
      explanation = `The portfolio has experienced a notable decline today, exceeding the 3% daily loss threshold. This may be driven by broader market movements or sector-specific weakness affecting holdings.`;
      suggestedAction = `Review the portfolio's sector exposure and consider whether the decline reflects a temporary market dislocation or a fundamental shift. If concentrated in specific holdings, evaluate whether rebalancing is appropriate.`;
    } else if (hasSingleStock) {
      headline = `Concentration risk in ${symbol}`;
      explanation = `${symbol} now exceeds 20% of the total portfolio value, creating concentration risk. This likely resulted from recent price appreciation outpacing other holdings. Excessive single-stock exposure increases portfolio volatility.`;
      suggestedAction = `Consider trimming the ${symbol} position to bring it closer to the target allocation. Redistribute proceeds across underweight positions to restore diversification.`;
    } else if (hasAllocationDrift) {
      headline = `Allocation drift exceeds policy threshold`;
      explanation = `One or more positions have drifted more than 5% from their target allocation weights due to differential price movements. Left unchecked, allocation drift can result in unintended risk exposures.`;
      suggestedAction = `Review the current allocation against targets and consider rebalancing overweight positions into underweight ones. Prioritize the largest drifts first.`;
    } else {
      headline = `Risk threshold breach detected`;
      explanation = `A risk threshold has been breached in this portfolio. The breach was detected by the automated monitoring system and requires review.`;
      suggestedAction = `Review the specific breach details and assess whether corrective action is needed. Consult the portfolio's investment policy statement for guidance.`;
    }

    return {
      headline,
      explanation,
      suggestedAction,
      severity,
      disclaimer: 'This is AI-generated commentary for informational purposes only. It does not constitute financial advice. Please consult a qualified financial advisor before making investment decisions.',
    };
  }
}
