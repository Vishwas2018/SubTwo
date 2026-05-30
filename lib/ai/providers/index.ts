import type { WizardInput } from '@/lib/schemas';
import type { GenerationResult } from '@/lib/ai/anthropic-client';

export type Provider = 'claude' | 'groq' | 'qwen';

export const VALID_PROVIDERS: Provider[] = ['claude', 'groq', 'qwen'];
export const FREE_PROVIDERS: Provider[] = ['groq', 'qwen'];

export type ProviderOptions = {
  timeout?: number;
};

export interface PlanProvider {
  generatePlan(input: WizardInput, opts?: ProviderOptions): Promise<GenerationResult>;
  /** Returns true when the required API key env var is present. */
  isAvailable(): boolean;
}

export function isValidProvider(p: unknown): p is Provider {
  return typeof p === 'string' && (VALID_PROVIDERS as string[]).includes(p);
}

export function isFreeProvider(p: Provider): boolean {
  return (FREE_PROVIDERS as string[]).includes(p);
}

export async function getProvider(provider: Provider): Promise<PlanProvider> {
  switch (provider) {
    case 'claude': {
      const { claudeProvider } = await import('./claude');
      return claudeProvider;
    }
    case 'groq': {
      const { groqProvider } = await import('./groq');
      return groqProvider;
    }
    case 'qwen': {
      const { qwenProvider } = await import('./qwen');
      return qwenProvider;
    }
  }
}
