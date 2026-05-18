import type { InsightPayload } from '@prr/shared';

/**
 * LLM Provider Interface — abstraction layer for AI commentary generation.
 */
export interface LLMProvider {
  readonly name: string;
  readonly modelVersion: string;
  generate(prompt: string): Promise<InsightPayload>;
}

/** Factory function to get the active LLM provider based on env config. */
export const getProvider = async (): Promise<LLMProvider> => {
  const providerName = process.env.LLM_PROVIDER ?? 'mock';
  switch (providerName.toLowerCase()) {
    case 'mock':
    default: {
      const { MockProvider } = await import('./mock.provider.js');
      return new MockProvider();
    }
  }
};
