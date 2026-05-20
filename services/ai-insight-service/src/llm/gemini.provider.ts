import type { InsightPayload } from '@prr/shared';
import type { LLMProvider } from './provider.js';

/**
 * Google Gemini LLM Provider.
 *
 * Calls the Gemini REST API directly (no SDK dependency needed).
 * The API key is loaded from AWS SSM Parameter Store at cold start.
 *
 * Model: gemini-2.0-flash (fast, cheap, good for structured output)
 */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly modelVersion: string;
  private apiKey: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.modelVersion = model ?? 'gemini-2.0-flash';
  }

  async generate(prompt: string): Promise<InsightPayload> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelVersion}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 300)}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Gemini returned no content');
    }

    // Parse the JSON response from Gemini
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as InsightPayload;

    return parsed;
  }
}
