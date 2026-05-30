'use client';

import { Progress } from '@/components/ui/progress';

type Props = {
  step: number;
  totalSteps: number;
};

const STEP_LABELS = [
  'Your Race',
  'About You',
  'Optional extras',
  'Generating',
];

export function WizardProgress({ step, totalSteps }: Props) {
  const pct = Math.round(((step - 1) / (totalSteps - 1)) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">
          {STEP_LABELS[step - 1] ?? `Step ${step}`}
        </span>
        <span className="text-slate-400">
          {step} / {totalSteps}
        </span>
      </div>
      <Progress
        value={pct}
        className="h-1.5"
        aria-label={`Step ${step} of ${totalSteps}`}
      />
    </div>
  );
}
