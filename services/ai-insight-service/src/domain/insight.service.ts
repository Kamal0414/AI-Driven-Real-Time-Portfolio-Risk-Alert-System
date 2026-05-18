import {
  createLogger,
  publishEvent,
  InsightPayloadSchema,
  EVENT_SOURCE,
  EVENT_TYPE,
} from '@prr/shared';
import type { RiskThresholdBreachedData, Insight, InsightPayload } from '@prr/shared';
import { getProvider } from '../llm/provider.js';
import { SYSTEM_PROMPT, buildBreachPrompt } from '../prompts/breach.prompt.js';
import * as insightRepo from '../repo/insight.repo.js';

const log = createLogger({ service: 'ai-insight-service' });

/**
 * Insight Domain Service — orchestrates LLM call, validation, persistence, and event publishing.
 *
 * Graceful degradation:
 * - If LLM fails → deterministic fallback
 * - If JSON validation fails → deterministic fallback
 * - The system NEVER stops working because of AI failure
 */
export const generateInsight = async (
  data: RiskThresholdBreachedData,
  correlationId: string,
): Promise<void> => {
  const provider = await getProvider();
  const prompt = `${SYSTEM_PROMPT}\n\n${buildBreachPrompt(data)}`;

  let payload: InsightPayload;
  let fallback = false;

  try {
    const raw = await provider.generate(prompt);
    const validated = InsightPayloadSchema.safeParse(raw);
    if (!validated.success) {
      log.warn('LLM output failed validation, using fallback', {
        portfolioId: data.portfolioId,
        errors: validated.error.flatten(),
      });
      payload = buildFallbackPayload(data);
      fallback = true;
    } else {
      payload = validated.data;
    }
  } catch (err) {
    log.error('LLM call failed, using fallback', { portfolioId: data.portfolioId, err });
    payload = buildFallbackPayload(data);
    fallback = true;
  }

  const now = new Date().toISOString();
  const insight: Insight = {
    ...payload,
    portfolioId: data.portfolioId,
    generatedAt: now,
    generatedBy: provider.name,
    modelVersion: provider.modelVersion,
    fallback,
    correlationId,
  };

  await insightRepo.saveInsight(insight);

  await publishEvent({
    eventType: EVENT_TYPE.AI_INSIGHT_GENERATED,
    source: EVENT_SOURCE.AI_INSIGHT,
    data: {
      portfolioId: insight.portfolioId,
      generatedAt: insight.generatedAt,
      generatedBy: insight.generatedBy,
      modelVersion: insight.modelVersion,
      fallback: insight.fallback,
      headline: insight.headline,
      explanation: insight.explanation,
      suggestedAction: insight.suggestedAction,
      severity: insight.severity,
      disclaimer: insight.disclaimer,
    },
    correlationId,
  });

  log.info('insight generated and published', {
    portfolioId: data.portfolioId,
    severity: payload.severity,
    fallback,
    provider: provider.name,
    correlationId,
  });
};

/** Deterministic fallback — always produces valid output when AI fails. */
const buildFallbackPayload = (data: RiskThresholdBreachedData): InsightPayload => {
  const primaryBreach = data.breaches[0]!;
  const symbol = primaryBreach.metrics.symbol ?? 'portfolio';

  return {
    headline: `Risk alert: ${primaryBreach.type.replace(/_/g, ' ').toLowerCase()} detected`,
    explanation: `A ${primaryBreach.severity.toLowerCase()} severity breach was detected for ${symbol}. ${primaryBreach.message}. Portfolio value: $${data.portfolioValue.toFixed(2)}.`,
    suggestedAction: `Review the portfolio allocation and consider rebalancing to address the ${primaryBreach.type.replace(/_/g, ' ').toLowerCase()} breach.`,
    severity: data.overallSeverity,
    disclaimer: 'This is an automated alert for informational purposes only. It does not constitute financial advice.',
  };
};
