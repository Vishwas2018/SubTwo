'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WizardProgress } from '@/components/wizard/wizard-progress';
import { Step1RaceBasics, validateStep1 } from '@/components/wizard/steps/step1-race-basics';
import { Step2AboutYou, validateStep2AboutYou } from '@/components/wizard/steps/step2-about-you';
import { Step3OptionalExtras } from '@/components/wizard/steps/step3-optional-extras';
import { Step7Generating } from '@/components/wizard/steps/step7-generating';
import { type WizardFormData, INITIAL_FORM_DATA } from '@/components/wizard/wizard-types';
import { assembleWizardInput } from '@/components/wizard/assemble-wizard-input';
import type { Provider } from '@/lib/ai/providers';

// Step 4 = Generating (previously Step 7)
const TOTAL_STEPS = 4;

const PROVIDER_OPTIONS: {
  value: Provider;
  label: string;
  free: boolean;
}[] = [
  { value: 'claude', label: 'SubTwo default (recommended)', free: false },
  { value: 'groq',  label: 'Groq — free, fast',            free: true  },
  { value: 'qwen',  label: 'Qwen — free',                  free: true  },
];

function isStepValid(step: number, data: WizardFormData): boolean {
  switch (step) {
    case 1: return validateStep1(data);
    case 2: return validateStep2AboutYou(data);
    case 3: return true; // always skippable
    default: return false;
  }
}

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>('claude');

  const handleChange = useCallback((patch: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

  function handleBack() {
    if (step > 1) setStep((s) => s - 1);
  }

  async function handleContinue() {
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }
    // Step 3 → Step 4: begin generation
    await startGeneration();
  }

  async function handleSkip() {
    // Skip optional extras and generate immediately
    await startGeneration();
  }

  async function startGeneration() {
    setStep(4);
    setIsSubmitting(true);
    setSubmitError(null);

    const assembled = assembleWizardInput(formData);
    if (!assembled.success) {
      setSubmitError(assembled.error);
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, ...assembled.data }),
      });

      const json = (await res.json()) as {
        data?: { plan_id: string };
        error?: { code: string; message: string };
      };

      if (!res.ok) {
        const code = json.error?.code ?? '';
        const msg = json.error?.message ?? 'Generation failed. Please try again.';
        setSubmitError(code === 'quota_exhausted' ? 'quota: ' + msg : msg);
        setIsSubmitting(false);
        return;
      }

      const planId = json.data?.plan_id;
      if (!planId) {
        setSubmitError('Unexpected response. Please try again.');
        setIsSubmitting(false);
        return;
      }

      router.push(`/onboarding/review?plan=${planId}`);
    } catch (err) {
      import('@sentry/nextjs').then(({ captureException }) => captureException(err));
      setSubmitError('Network error. Check your connection and try again.');
      setIsSubmitting(false);
    }
  }

  const canContinue = step < 4 && isStepValid(step, formData);
  const selectedOption = PROVIDER_OPTIONS.find((o) => o.value === provider)!;

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center pt-8 pb-16 px-4">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Build your plan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Answer a few questions — your AI coach handles the rest.
          </p>
        </div>

        <WizardProgress step={step} totalSteps={TOTAL_STEPS} />

        <Card className="shadow-sm">
          <CardContent className="pt-6 pb-6">
            {step === 1 && (
              <Step1RaceBasics data={formData} onChange={handleChange} />
            )}
            {step === 2 && (
              <Step2AboutYou data={formData} onChange={handleChange} />
            )}
            {step === 3 && (
              <Step3OptionalExtras data={formData} onChange={handleChange} />
            )}
            {step === 4 && (
              <Step7Generating
                error={submitError}
                onRetry={() => {
                  setStep(3);
                  setSubmitError(null);
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* ── Step 3: provider selector + Skip + Generate ── */}
        {step === 3 && (
          <>
            <div className="space-y-2">
              <label htmlFor="provider-select" className="text-sm font-medium text-slate-700">
                AI provider
              </label>
              <select
                id="provider-select"
                value={provider}
                onChange={(e) => setProvider(e.target.value as Provider)}
                aria-label="Select AI provider"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {selectedOption.free && (
                <p className="text-xs text-amber-600">
                  Free tier — variable quality, may take longer.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={handleBack} aria-label="Go back">
                ← Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { void handleSkip(); }}
                  disabled={isSubmitting}
                  aria-label="Skip optional extras and generate plan"
                >
                  Skip — set these later
                </Button>
                <Button
                  onClick={() => { void handleContinue(); }}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  aria-label="Generate plan"
                >
                  Generate plan →
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Steps 1 & 2: standard Back / Continue ── */}
        {(step === 1 || step === 2) && (
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 1}
              aria-label="Go back"
            >
              ← Back
            </Button>

            <Button
              onClick={() => { void handleContinue(); }}
              disabled={!canContinue || isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-30"
              aria-label={step === 2 ? 'Continue to optional extras' : 'Continue to next step'}
            >
              Continue →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
