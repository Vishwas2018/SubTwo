'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { type WizardFormData, type GoalType, timeToSeconds } from '../wizard-types';
import { TimeInput } from '../time-input';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

export function Step3OptionalExtras({ data, onChange }: Props) {
  const level = data.experience_level;
  const injuryLen = data.injury_history.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Optional extras</h2>
        <p className="mt-1 text-sm text-slate-500">
          All fields optional — you can skip this step entirely.
        </p>
      </div>

      {/* Goal — intermediate and advanced can set a target time */}
      {(level === 'intermediate' || level === 'advanced') && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-700">Goal time</p>
          <RadioGroup
            value={data.goal_type}
            onValueChange={(v) => onChange({ goal_type: v as GoalType })}
            aria-label="Goal type"
          >
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="ai_suggest" id="goal-ai" className="mt-1" />
              <Label htmlFor="goal-ai" className="flex flex-col cursor-pointer">
                <span className="font-medium">Let AI suggest a target</span>
                <span className="text-sm text-slate-500 font-normal">
                  Based on your fitness data
                </span>
              </Label>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="specific" id="goal-specific" className="mt-1" />
              <Label htmlFor="goal-specific" className="flex flex-col cursor-pointer">
                <span className="font-medium">I have a target time</span>
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
      )}

      {/* Injury history */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="injury_history">Injury history</Label>
          <span
            className={`text-xs ${injuryLen > 450 ? 'text-amber-600' : 'text-slate-400'}`}
            aria-live="polite"
          >
            {injuryLen}/500
          </span>
        </div>
        <Textarea
          id="injury_history"
          placeholder="e.g. right calf strain 3 months ago, fully recovered"
          maxLength={500}
          rows={3}
          value={data.injury_history}
          onChange={(e) => onChange({ injury_history: e.target.value })}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Anything else the AI should know</Label>
        <Textarea
          id="notes"
          placeholder="e.g. I travel for work on Wednesdays"
          maxLength={500}
          rows={2}
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>

      {/* Equipment */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-slate-700">Equipment</p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="shoes">Running shoes</Label>
            <Input
              id="shoes"
              type="text"
              placeholder="e.g. Nike Vaporfly Next% 2"
              maxLength={100}
              value={data.shoes}
              onChange={(e) => onChange({ shoes: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fuel">Preferred fuel / gels</Label>
            <Input
              id="fuel"
              type="text"
              placeholder="e.g. Maurten 100, SIS gels"
              maxLength={100}
              value={data.fuel}
              onChange={(e) => onChange({ fuel: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weight_kg">Body weight (kg)</Label>
            <Input
              id="weight_kg"
              type="number"
              min="30"
              max="200"
              step="0.1"
              placeholder="e.g. 68"
              value={data.weight_kg}
              onChange={(e) => onChange({ weight_kg: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Always valid — all fields optional
export function validateStep3OptionalExtras(): boolean {
  return true;
}
