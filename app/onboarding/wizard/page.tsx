'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WizardProgress } from '@/components/wizard/wizard-progress';
import { Step1RaceBasics, validateStep1 } from '@/components/wizard/steps/step1-race-basics';
import { Step2Experience, validateStep2 } from '@/components/wizard/steps/step2-experience';
import { Step3Fitness, validateStep3 } from '@/components/wizard/steps/step3-fitness';
import { Step4Goal, validateStep4 } from '@/components/wizard/steps/step4-goal';
import { Step5Constraints, validateStep5 } from '@/components/wizard/steps/step5-constraints';
import { Step6Equipment, validateStep6 } from '@/components/wizard/steps/step6-equipment';
import { Step7Generating } from '@/components/wizard/steps/step7-generating';
import { type WizardFormData, INITIAL_FORM_DATA } from '@/components/wizard/wizard-types';
import { assembleWizardInput } from '@/components/wizard/assemble-wizard-input';

const TOTAL_STEPS = 7;

function isStepValid(step: number, data: WizardFormData): boolean {
  switch (step) {
    case 1: return validateStep1(data);
    case 2: return validateStep2(data);
    case 3: return validateStep3(data);
    case 4: return validateStep4(data);
    case 5: return validateStep5(data);
    case 6: return validateStep6();
    default: return false;
  }
}

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = useCallback((patch: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

  function handleBack() {
    if (step > 1) setStep((s) => s - 1);
  }

  async function handleContinue() {
    if (step < 6) {
      setStep((s) => s + 1);
      return;
    }
    // Step 6 → Step 7: begin generation
    setStep(7);
    await submitPlan();
  }

  async function submitPlan() {
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
        body: JSON.stringify(assembled.data),
      });

      const json = (await res.json()) as {
        data?: { plan_id: string };
        error?: { code: string; message: string };
      };

      if (!res.ok) {
        const code = json.error?.code ?? '';
        const msg = json.error?.message ?? 'Generation failed. Please try again.';
        if (code === 'quota_exhausted') {
          setSubmitError('quota: ' + msg);
        } else {
          setSubmitError(msg);
        }
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

  const canContinue = step < 7 && isStepValid(step, formData);

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center pt-8 pb-16 px-4">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Build your plan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Answer 6 quick questions — your AI coach handles the rest.
          </p>
        </div>

        <WizardProgress step={step} totalSteps={TOTAL_STEPS} />

        <Card className="shadow-sm">
          <CardContent className="pt-6 pb-6">
            {step === 1 && (
              <Step1RaceBasics data={formData} onChange={handleChange} />
            )}
            {step === 2 && (
              <Step2Experience data={formData} onChange={handleChange} />
            )}
            {step === 3 && (
              <Step3Fitness data={formData} onChange={handleChange} />
            )}
            {step === 4 && (
              <Step4Goal data={formData} onChange={handleChange} />
            )}
            {step === 5 && (
              <Step5Constraints data={formData} onChange={handleChange} />
            )}
            {step === 6 && (
              <Step6Equipment data={formData} onChange={handleChange} />
            )}
            {step === 7 && (
              <Step7Generating
                error={submitError}
                onRetry={() => {
                  setStep(6);
                  setSubmitError(null);
                }}
              />
            )}
          </CardContent>
        </Card>

        {step < 7 && (
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
              onClick={handleContinue}
              disabled={!canContinue || isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
              aria-label={step === 6 ? 'Generate plan' : 'Continue to next step'}
            >
              {step === 6 ? 'Generate plan →' : 'Continue →'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
