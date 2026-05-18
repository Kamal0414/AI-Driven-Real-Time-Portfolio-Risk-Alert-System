import { z } from 'zod';
import { eventEnvelopeSchema } from './envelope.js';
import { InsightPayloadSchema } from '../domain/insight.js';
import { EVENT_TYPE } from '../constants.js';

export const AIInsightGeneratedDataSchema = InsightPayloadSchema.extend({
  portfolioId: z.string().min(1),
  generatedAt: z.string().datetime(),
  generatedBy: z.string().min(1),
  modelVersion: z.string().min(1).optional(),
  /** True when the LLM call failed and a deterministic fallback was used. */
  fallback: z.boolean(),
});
export type AIInsightGeneratedData = z.infer<typeof AIInsightGeneratedDataSchema>;

export const AIInsightGeneratedEventSchema = eventEnvelopeSchema(AIInsightGeneratedDataSchema).extend(
  { eventType: z.literal(EVENT_TYPE.AI_INSIGHT_GENERATED) },
);
export type AIInsightGeneratedEvent = z.infer<typeof AIInsightGeneratedEventSchema>;
