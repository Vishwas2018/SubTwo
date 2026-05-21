'use client';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { type WizardFormData, type ExperienceLevel } from '../wizard-types';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

const LEVELS: { value: ExperienceLevel; label: string; description: string }[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'New to structured training or running less than 2 years. Building base fitness.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable with regular training, have completed races, following a program.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Consistent high mileage, track workouts, chasing personal bests.',
  },
];

export function Step2Experience({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Your experience level</h2>
        <p className="mt-1 text-sm text-slate-500">
          This shapes the questions we ask and how we structure your plan.
        </p>
      </div>

      <RadioGroup
        value={data.experience_level}
        onValueChange={(val) => onChange({ experience_level: val as ExperienceLevel })}
        aria-label="Experience level"
      >
        {LEVELS.map((level) => (
          <div key={level.value} className="flex items-start space-x-3">
            <RadioGroupItem
              value={level.value}
              id={`level-${level.value}`}
              className="mt-1"
            />
            <Label
              htmlFor={`level-${level.value}`}
              className="flex flex-col cursor-pointer"
            >
              <span className="font-medium text-slate-900">{level.label}</span>
              <span className="text-sm text-slate-500 font-normal">{level.description}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export function validateStep2(data: WizardFormData): boolean {
  return data.experience_level === 'beginner' ||
    data.experience_level === 'intermediate' ||
    data.experience_level === 'advanced';
}
