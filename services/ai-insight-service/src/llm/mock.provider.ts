import type { InsightPayload } from '@prr/shared';
import type { LLMProvider } from './provider.js';

/**
 * Mock LLM Provider — generates contextual commentary using actual
 * breach metadata extracted from the prompt. No external API calls.
 *
 * The prompt is built from RiskThresholdBreachedData (see breach.prompt.ts),
 * so it contains real numbers like:
 *   "actualValue=0.235, targetValue=0.20, deviation=0.035"
 * We parse those out and inject them into the explanation.
 */
export class MockProvider implements LLMProvider {
  readonly name = 'mock';
  readonly modelVersion = 'mock-v1';

  async generate(prompt: string): Promise<InsightPayload> {
    // Tiny delay so the dashboard can show a nice "AI generating..." moment.
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

    const breachType = this.extractBreachType(prompt);
    const symbol = this.extractSymbol(prompt);
    const severity = this.extractSeverity(prompt);
    const portfolioValue = this.extractPortfolioValue(prompt);
    const metrics = this.extractMetrics(prompt);

    let headline: string;
    let explanation: string;
    let suggestedAction: string;

    if (breachType === 'DAILY_PORTFOLIO_DROP') {
      const dropPct = Math.abs(metrics.actualValue * 100);
      headline = `Portfolio down ${dropPct.toFixed(2)}% today`;
      explanation = `Total portfolio value declined ${dropPct.toFixed(2)}% within the trading day, exceeding the 3.00% daily-loss policy threshold. Current value sits at $${portfolioValue.toFixed(2)}. Sharp intraday drawdowns can be driven by sector rotation, macroeconomic news, or correlated holdings moving together.`;
      suggestedAction = `Review the largest contributors to today's loss. If the decline is concentrated in one or two positions, consider whether it reflects a temporary dislocation or a fundamental change worth acting on. Avoid making decisions purely on intraday volatility.`;
    } else if (breachType === 'SINGLE_STOCK_EXPOSURE') {
      const actualPct = metrics.actualValue * 100;
      const excessPct = (metrics.actualValue - metrics.targetValue) * 100;
      headline = `${symbol} is ${actualPct.toFixed(1)}% of portfolio`;
      explanation = `${symbol} now represents ${actualPct.toFixed(1)}% of the total portfolio value of $${portfolioValue.toFixed(2)}, exceeding the 20% concentration policy by ${excessPct.toFixed(1)} percentage points. This typically results from outsized appreciation in a single name and increases portfolio volatility relative to the target risk profile.`;
      suggestedAction = `Consider trimming ${symbol} by approximately ${excessPct.toFixed(1)} percentage points and reallocating proceeds to underweight positions to restore diversification. Use tax-aware lot selection if applicable.`;
    } else if (breachType === 'ALLOCATION_DRIFT') {
      const actualPct = metrics.actualValue * 100;
      const targetPct = metrics.targetValue * 100;
      const driftPct = metrics.deviation * 100;
      const direction = driftPct > 0 ? 'overweight' : 'underweight';
      headline = `${symbol} is ${Math.abs(driftPct).toFixed(1)}% ${direction}`;
      explanation = `${symbol} currently represents ${actualPct.toFixed(1)}% of the portfolio versus the target weight of ${targetPct.toFixed(1)}% — a ${direction} drift of ${Math.abs(driftPct).toFixed(1)} percentage points. Allocation drift exceeding the 5% policy can shift the portfolio's risk-return profile away from the model.`;
      suggestedAction = direction === 'overweight'
        ? `Consider trimming ${symbol} by ${Math.abs(driftPct).toFixed(1)} percentage points to bring it back to its ${targetPct.toFixed(1)}% target weight.`
        : `Consider increasing ${symbol} by ${Math.abs(driftPct).toFixed(1)} percentage points to bring it up to its ${targetPct.toFixed(1)}% target weight.`;
    } else {
      headline = `Risk threshold breach detected`;
      explanation = `An automated risk monitor detected a breach in this portfolio. Portfolio value is currently $${portfolioValue.toFixed(2)}.`;
      suggestedAction = `Review the breach details and consult the portfolio's investment policy statement before acting.`;
    }

    return {
      headline,
      explanation,
      suggestedAction,
      severity,
      disclaimer: 'This is AI-generated commentary for informational purposes only. It does not constitute financial advice. Please consult a qualified financial advisor before making investment decisions.',
    };
  }

  private extractBreachType(prompt: string): string {
    if (prompt.includes('DAILY_PORTFOLIO_DROP')) return 'DAILY_PORTFOLIO_DROP';
    if (prompt.includes('SINGLE_STOCK_EXPOSURE')) return 'SINGLE_STOCK_EXPOSURE';
    if (prompt.includes('ALLOCATION_DRIFT')) return 'ALLOCATION_DRIFT';
    return 'UNKNOWN';
  }

  private extractSymbol(prompt: string): string {
    const match = prompt.match(/symbol:\s*([A-Z]{2,5})/);
    return match?.[1] ?? 'the position';
  }

  private extractSeverity(prompt: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    const match = prompt.match(/Overall Severity:\s*(LOW|MEDIUM|HIGH)/i);
    const sev = match?.[1]?.toUpperCase();
    if (sev === 'LOW' || sev === 'MEDIUM' || sev === 'HIGH') return sev;
    return 'MEDIUM';
  }

  private extractPortfolioValue(prompt: string): number {
    const match = prompt.match(/Portfolio Value:\s*\$?([0-9.]+)/);
    return match?.[1] ? parseFloat(match[1]) : 0;
  }

  private extractMetrics(prompt: string): { actualValue: number; targetValue: number; deviation: number } {
    const actual = prompt.match(/actualValue=(-?[0-9.]+)/)?.[1];
    const target = prompt.match(/targetValue=(-?[0-9.]+)/)?.[1];
    const deviation = prompt.match(/deviation=(-?[0-9.]+)/)?.[1];
    return {
      actualValue: actual ? parseFloat(actual) : 0,
      targetValue: target ? parseFloat(target) : 0,
      deviation: deviation ? parseFloat(deviation) : 0,
    };
  }
}
