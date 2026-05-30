import { generatePlan } from '@/lib/ai/anthropic-client';
import type { PlanProvider, ProviderOptions } from './index';
import type { WizardInput } from '@/lib/schemas';

export const claudeProvider: PlanProvider = {
  isAvailable() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },

  generatePlan(input: WizardInput, opts?: ProviderOptions) {
    return generatePlan(input, { timeout: opts?.timeout });
  },
};
