'use client';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { type WizardFormData, type GoalType, timeToSeconds } from '../wizard-types';
import { TimeInput } from '../time-input';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

export function Step4Goal({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Your goal</h2>
        <p className="mt-1 text-sm text-slate-500">
          A target time gives us more to work with, but the AI can suggest one too.
        </p>
      </div>

      <RadioGroup
        value={data.goal_type}
        onValueChange={(v) => onChange({ goal_type: v as GoalType })}
        aria-label="Goal type"
      >
        <div className="flex items-start space-x-3">
          <RadioGroupItem value="specific" id="goal-specific" className="mt-1" />
          <Label htmlFor="goal-specific" className="flex flex-col cursor-pointer">
            <span className="font-medium">I have a target time</span>
            <span className="text-sm text-slate-500 font-normal">
              e.g. sub-2 hours for a half marathon
            </span>
          </Label>
        </div>

        <div className="flex items-start space-x-3">
          <RadioGroupItem value="ai_suggest" id="goal-ai" className="mt-1" />
          <Label htmlFor="goal-ai" className="flex flex-col cursor-pointer">
            <span className="font-medium">Suggest a realistic target for me</span>
            <span className="text-sm text-slate-500 font-normal">
              Based on your recent race and fitness data
            </span>
          </Label>
        </div>
      </RadioGroup>

      {data.goal_type === 'specific' && (
        <div className="space-y-2 pl-6">
          <Label htmlFor="goal_time">Target time (h:mm:ss)</Label>
          <TimeInput
            id="goal_time"
            value={data.goal_time}
            onChange={(v) => onChange({ goal_time: v })}
            placeholder="e.g. 1:59:59"
          />
          {data.goal_time && timeToSeconds(data.goal_time) === null && (
            <p className="text-xs text-red-600" role="alert">
              Enter a valid time, e.g. 1:59:59
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function validateStep4(data: WizardFormData): boolean {
  if (!data.goal_type) return false;
  if (data.goal_type === 'ai_suggest') return true;
  // specific: must have a valid time
  const secs = timeToSeconds(data.goal_time);
  return secs !== null && secs > 0;
}
