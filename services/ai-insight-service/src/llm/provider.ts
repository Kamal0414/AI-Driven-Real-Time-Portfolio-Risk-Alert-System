import type { InsightPayload } from '@prr/shared';
import { createLogger } from '@prr/shared';

const log = createLogger({ service: 'ai-insight-service', component: 'llm-provider' });

/**
 * LLM Provider Interface — abstraction layer for AI commentary generation.
 */
export interface LLMProvider {
  readonly name: string;
  readonly modelVersion: string;
  generate(prompt: string): Promise<InsightPayload>;
}

/** Cached API key from SSM (loaded once per Lambda cold start). */
let cachedApiKey: string | null = null;

/** Load API key from SSM Parameter Store. */
async function loadApiKeyFromSsm(paramName: string): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
  const ssm = new SSMClient({});
  const result = await ssm.send(
    new GetParameterCommand({ Name: paramName, WithDecryption: true }),
  );
  const value = result.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter ${paramName} is empty or not found`);
  cachedApiKey = value;
  return value;
}

/** Factory function to get the active LLM provider based on env config. */
export const getProvider = async (): Promise<LLMProvider> => {
  const providerName = process.env.LLM_PROVIDER ?? 'mock';
  const model = process.env.LLM_MODEL ?? undefined;

  switch (providerName.toLowerCase()) {
    case 'gemini': {
      const paramName = process.env.LLM_API_KEY_PARAM ?? '/prr/llm-api-key';
      const apiKey = await loadApiKeyFromSsm(paramName);
      const { GeminiProvider } = await import('./gemini.provider.js');
      log.info('using Gemini provider', { model: model ?? 'gemini-2.0-flash' });
      return new GeminiProvider(apiKey, model);
    }
    case 'mock':
    default: {
      const { MockProvider } = await import('./mock.provider.js');
      log.info('using Mock provider');
      return new MockProvider();
    }
  }
};
