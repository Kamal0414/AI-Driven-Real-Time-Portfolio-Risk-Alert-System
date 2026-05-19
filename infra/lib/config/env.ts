/**
 * Environment configuration for CDK stacks.
 * All tunable parameters live here — no magic strings in stack code.
 */

export interface AppConfig {
  /** AWS region to deploy into. */
  region: string;
  /** Stack name prefix to avoid collisions in shared accounts. */
  prefix: string;
  /** EventBridge custom bus name. */
  eventBusName: string;
  /** Market data tick interval in minutes (EventBridge Scheduler rate). Minimum 1. */
  tickIntervalMinutes: number;
  /** DynamoDB billing mode: PAY_PER_REQUEST (Free Tier friendly) or PROVISIONED. */
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
  /** TTL in hours for Valuations table items. */
  valuationTtlHours: number;
  /** TTL in days for Insights table items. */
  insightTtlDays: number;
  /** TTL in days for Alerts table items. */
  alertTtlDays: number;
  /** LLM provider (mock | openai | gemini | bedrock). */
  llmProvider: string;
  /** SSM parameter name for the LLM API key. */
  llmApiKeyParam: string;
  /** LLM model identifier. */
  llmModel: string;
  /** Log level for Lambda functions. */
  logLevel: string;
}

/**
 * Default config tuned for student Free Tier usage.
 * Override via environment variables or CDK context if needed.
 */
export const getConfig = (): AppConfig => ({
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  prefix: 'prr',
  eventBusName: 'portfolio-risk-bus',
  tickIntervalMinutes: 1,
  billingMode: 'PAY_PER_REQUEST',
  valuationTtlHours: 24,
  insightTtlDays: 7,
  alertTtlDays: 7,
  llmProvider: process.env.LLM_PROVIDER ?? 'mock',
  llmApiKeyParam: process.env.LLM_API_KEY_PARAM ?? '/prr/llm-api-key',
  llmModel: process.env.LLM_MODEL ?? 'mock',
  logLevel: process.env.LOG_LEVEL ?? 'info',
});
