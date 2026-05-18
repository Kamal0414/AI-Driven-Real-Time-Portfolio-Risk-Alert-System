import type { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { createLogger } from '@prr/shared';
import type { RiskThresholdBreachedData } from '@prr/shared';
import { generateInsight } from '../domain/insight.service.js';

const log = createLogger({ service: 'ai-insight-service' });

/**
 * onRiskBreached — SQS-triggered Lambda handler.
 *
 * Receives RiskThresholdBreached events from the AI SQS queue.
 * Uses partial batch failure reporting so one bad message doesn't block others.
 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const ebEvent = JSON.parse(record.body);
      const detail = ebEvent.detail ?? ebEvent;
      const breachData: RiskThresholdBreachedData = detail.data ?? detail;
      const correlationId: string = detail.correlationId ?? ebEvent.id ?? record.messageId;

      log.info('processing risk breach', {
        portfolioId: breachData.portfolioId,
        breachCount: breachData.breaches?.length,
        severity: breachData.overallSeverity,
        correlationId,
      });

      await generateInsight(breachData, correlationId);
    } catch (err) {
      log.error('failed to process SQS message', { messageId: record.messageId, err });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
